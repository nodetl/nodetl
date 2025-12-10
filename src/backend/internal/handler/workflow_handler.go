package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type WorkflowHandler struct {
	repo        repository.WorkflowRepository
	projectRepo *repository.ProjectRepository
}

func NewWorkflowHandler(repo repository.WorkflowRepository, projectRepo *repository.ProjectRepository) *WorkflowHandler {
	return &WorkflowHandler{
		repo:        repo,
		projectRepo: projectRepo,
	}
}

// CreateWorkflow creates a new workflow
func (h *WorkflowHandler) CreateWorkflow(c *gin.Context) {
	var workflow domain.Workflow
	if err := c.ShouldBindJSON(&workflow); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	workflow.Status = domain.WorkflowStatusDraft

	// Auto-assign default project if no project specified
	var project *domain.Project
	if workflow.ProjectID == "" && h.projectRepo != nil {
		defaultProject, err := h.projectRepo.GetDefaultProject(c.Request.Context())
		if err == nil {
			workflow.ProjectID = defaultProject.ID.Hex()
			project = defaultProject
		}
	} else if workflow.ProjectID != "" && h.projectRepo != nil {
		p, err := h.projectRepo.GetByID(c.Request.Context(), workflow.ProjectID)
		if err == nil {
			project = p
		}
	}

	// Auto-prefix webhook paths with project pathPrefix and validate uniqueness
	if project != nil {
		pathPrefix := project.PathPrefix
		if pathPrefix == "" {
			pathPrefix = "/api/" + project.VersionTag
		}

		for i := range workflow.Nodes {
			node := &workflow.Nodes[i]
			if node.Type == domain.NodeTypeTrigger && node.Data.WebhookPath != "" {
				// Auto-add prefix if not already present
				if !strings.HasPrefix(node.Data.WebhookPath, pathPrefix) {
					cleanPath := strings.TrimPrefix(node.Data.WebhookPath, "/")
					node.Data.WebhookPath = pathPrefix + "/" + cleanPath
				}

				// Check endpoint uniqueness
				exists, err := h.repo.CheckEndpointExists(c.Request.Context(), node.Data.WebhookPath, nil)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate endpoint"})
					return
				}
				if exists {
					c.JSON(http.StatusConflict, gin.H{
						"error":  "Endpoint already exists: " + node.Data.WebhookPath,
						"field":  "webhookPath",
						"nodeId": node.ID,
					})
					return
				}
			}
		}
	}

	if err := h.repo.Create(c.Request.Context(), &workflow); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, workflow)
}

// GetWorkflow gets a workflow by ID
func (h *WorkflowHandler) GetWorkflow(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workflow ID"})
		return
	}

	workflow, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if workflow == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "workflow not found"})
		return
	}

	c.JSON(http.StatusOK, workflow)
}

// ListWorkflows lists all workflows with pagination
func (h *WorkflowHandler) ListWorkflows(c *gin.Context) {
	filter := repository.WorkflowFilter{
		Page:     1,
		PageSize: 20,
	}

	// Parse query params
	if status := c.Query("status"); status != "" {
		s := domain.WorkflowStatus(status)
		filter.Status = &s
	}
	if name := c.Query("name"); name != "" {
		filter.Name = &name
	}

	workflows, total, err := h.repo.GetAll(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":     workflows,
		"total":    total,
		"page":     filter.Page,
		"pageSize": filter.PageSize,
	})
}

// UpdateWorkflow updates a workflow
func (h *WorkflowHandler) UpdateWorkflow(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workflow ID"})
		return
	}

	existing, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "workflow not found"})
		return
	}

	var workflow domain.Workflow
	if err := c.ShouldBindJSON(&workflow); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if current project is locked (before any changes)
	if existing.ProjectID != "" && h.projectRepo != nil {
		currentProject, err := h.projectRepo.GetByID(c.Request.Context(), existing.ProjectID)
		if err == nil && currentProject != nil && currentProject.IsLocked {
			c.JSON(http.StatusForbidden, gin.H{"error": "Cannot modify workflow in a locked project."})
			return
		}
	}

	// Check if target project is locked (if moving to different project)
	if workflow.ProjectID != "" && workflow.ProjectID != existing.ProjectID && h.projectRepo != nil {
		targetProject, err := h.projectRepo.GetByID(c.Request.Context(), workflow.ProjectID)
		if err == nil && targetProject != nil && targetProject.IsLocked {
			c.JSON(http.StatusForbidden, gin.H{"error": "Cannot move workflow to a locked project."})
			return
		}
	}

	workflow.ID = id
	workflow.CreatedAt = existing.CreatedAt
	workflow.CreatedBy = existing.CreatedBy

	// Keep name if not provided
	if workflow.Name == "" {
		workflow.Name = existing.Name
	}

	// Keep description if not provided
	if workflow.Description == "" {
		workflow.Description = existing.Description
	}

	// Validate projectID is required
	if workflow.ProjectID == "" {
		if existing.ProjectID != "" {
			workflow.ProjectID = existing.ProjectID
		} else {
			// Auto-assign default project
			if h.projectRepo != nil {
				defaultProject, err := h.projectRepo.GetDefaultProject(c.Request.Context())
				if err == nil && defaultProject != nil {
					workflow.ProjectID = defaultProject.ID.Hex()
				}
			}
		}
	}

	// Get project for prefix
	var project *domain.Project
	if workflow.ProjectID != "" && h.projectRepo != nil {
		p, err := h.projectRepo.GetByID(c.Request.Context(), workflow.ProjectID)
		if err == nil {
			project = p
		}
	}

	// Validate endpoint uniqueness for trigger nodes
	if project != nil {
		pathPrefix := project.PathPrefix
		if pathPrefix == "" {
			pathPrefix = "/api/" + project.VersionTag
		}

		for i := range workflow.Nodes {
			node := &workflow.Nodes[i]
			if node.Type == domain.NodeTypeTrigger && node.Data.WebhookPath != "" {
				// Auto-add prefix if not already present
				if !strings.HasPrefix(node.Data.WebhookPath, pathPrefix) {
					cleanPath := strings.TrimPrefix(node.Data.WebhookPath, "/")
					node.Data.WebhookPath = pathPrefix + "/" + cleanPath
				}

				// Check endpoint uniqueness (exclude current workflow)
				exists, err := h.repo.CheckEndpointExists(c.Request.Context(), node.Data.WebhookPath, &id)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate endpoint"})
					return
				}
				if exists {
					c.JSON(http.StatusConflict, gin.H{
						"error":  "Endpoint already exists: " + node.Data.WebhookPath,
						"field":  "webhookPath",
						"nodeId": node.ID,
					})
					return
				}
			}
		}
	}

	if err := h.repo.Update(c.Request.Context(), &workflow); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, workflow)
}

// DeleteWorkflow deletes a workflow
func (h *WorkflowHandler) DeleteWorkflow(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workflow ID"})
		return
	}

	// Get workflow to check status and project lock
	workflow, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if workflow == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "workflow not found"})
		return
	}

	// Check if workflow is active
	if workflow.Status == domain.WorkflowStatusActive {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Cannot delete an active workflow. Deactivate it first.",
		})
		return
	}

	// Check if project is locked
	if workflow.ProjectID != "" && h.projectRepo != nil {
		project, err := h.projectRepo.GetByID(c.Request.Context(), workflow.ProjectID)
		if err == nil && project != nil && project.IsLocked {
			c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete workflow from a locked project."})
			return
		}
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "workflow deleted"})
}

// ActivateWorkflow activates a workflow and generates endpoint
func (h *WorkflowHandler) ActivateWorkflow(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workflow ID"})
		return
	}

	workflow, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if workflow == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "workflow not found"})
		return
	}

	workflow.Status = domain.WorkflowStatusActive

	// Generate endpoint if not exists
	if workflow.Endpoint == nil {
		workflow.Endpoint = &domain.EndpointConfig{
			Path:     "/webhook/" + id.Hex(),
			Method:   "POST",
			AuthType: "none",
		}
	}

	if err := h.repo.Update(c.Request.Context(), workflow); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, workflow)
}

// DeactivateWorkflow deactivates a workflow
func (h *WorkflowHandler) DeactivateWorkflow(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workflow ID"})
		return
	}

	workflow, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if workflow == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "workflow not found"})
		return
	}

	workflow.Status = domain.WorkflowStatusInactive

	if err := h.repo.Update(c.Request.Context(), workflow); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, workflow)
}

// PatchWorkflowRequest for partial updates (auto-save)
type PatchWorkflowRequest struct {
	Nodes []domain.Node `json:"nodes,omitempty"`
	Edges []domain.Edge `json:"edges,omitempty"`
}

// PatchWorkflow performs a lightweight partial update (optimized for auto-save)
func (h *WorkflowHandler) PatchWorkflow(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workflow ID"})
		return
	}

	var req PatchWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Build partial update
	updates := make(map[string]interface{})
	if req.Nodes != nil {
		updates["nodes"] = req.Nodes
	}
	if req.Edges != nil {
		updates["edges"] = req.Edges
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	if err := h.repo.PartialUpdate(c.Request.Context(), id, updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return minimal response for auto-save
	c.JSON(http.StatusOK, gin.H{
		"id":      id.Hex(),
		"success": true,
	})
}
