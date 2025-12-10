package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ProjectHandler struct {
	repo         *repository.ProjectRepository
	workflowRepo repository.WorkflowRepository
}

func NewProjectHandler(repo *repository.ProjectRepository, workflowRepo repository.WorkflowRepository) *ProjectHandler {
	return &ProjectHandler{repo: repo, workflowRepo: workflowRepo}
}

// List godoc
// @Summary List all projects with pagination
// @Description Get paginated list of projects with workflow counts
// @Tags projects
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param pageSize query int false "Page size" default(10)
// @Param search query string false "Search term"
// @Param status query string false "Filter by status"
// @Success 200 {object} domain.ProjectListResponse
// @Router /projects [get]
func (h *ProjectHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	search := c.Query("search")
	status := c.Query("status")

	filter := repository.ProjectFilter{
		Page:     page,
		PageSize: pageSize,
		Search:   search,
		Status:   status,
	}

	response, err := h.repo.List(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch projects"})
		return
	}

	c.JSON(http.StatusOK, response)
}

// Get godoc
// @Summary Get a project by ID
// @Description Get project details including all workflows
// @Tags projects
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Success 200 {object} domain.Project
// @Router /projects/{id} [get]
func (h *ProjectHandler) Get(c *gin.Context) {
	id := c.Param("id")

	project, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	c.JSON(http.StatusOK, project)
}

// Create godoc
// @Summary Create a new project
// @Description Create a new project with version tag
// @Tags projects
// @Accept json
// @Produce json
// @Param project body domain.Project true "Project data"
// @Success 201 {object} domain.Project
// @Router /projects [post]
func (h *ProjectHandler) Create(c *gin.Context) {
	var project domain.Project
	if err := c.ShouldBindJSON(&project); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context
	userID, _ := c.Get("userID")
	if userID != nil {
		if oid, ok := userID.(primitive.ObjectID); ok {
			project.CreatedBy = oid.Hex()
		} else if str, ok := userID.(string); ok {
			project.CreatedBy = str
		}
	}

	// Set default status
	if project.Status == "" {
		project.Status = domain.ProjectStatusDraft
	}

	// Set default versionTag if not provided
	if project.VersionTag == "" {
		project.VersionTag = "1.0.0"
	}

	// Auto-generate pathPrefix: /api/{project_name}/{version_tag}
	if project.PathPrefix == "" {
		// Normalize project name for URL (lowercase, replace spaces with hyphens)
		normalizedName := strings.ToLower(strings.ReplaceAll(project.Name, " ", "-"))
		project.PathPrefix = "/api/" + normalizedName + "/" + project.VersionTag
	}

	if err := h.repo.Create(c.Request.Context(), &project); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}

	c.JSON(http.StatusCreated, project)
}

// Update godoc
// @Summary Update a project
// @Description Update project metadata (name, description, version tag, status)
// @Tags projects
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Param project body domain.Project true "Project data"
// @Success 200 {object} domain.Project
// @Router /projects/{id} [put]
func (h *ProjectHandler) Update(c *gin.Context) {
	id := c.Param("id")

	// Get existing project to check lock status
	existing, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	var project domain.Project
	if err := c.ShouldBindJSON(&project); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// If project is locked, only allow unlocking (changing isLocked to false)
	if existing.IsLocked && project.IsLocked {
		c.JSON(http.StatusForbidden, gin.H{"error": "Project is locked. Unlock it first to make changes."})
		return
	}

	if err := h.repo.Update(c.Request.Context(), id, &project); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	// Get updated project
	updated, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated project"})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// Delete godoc
// @Summary Delete a project
// @Description Delete a project and all its workflows
// @Tags projects
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Success 204
// @Router /projects/{id} [delete]
func (h *ProjectHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	// Check if project exists
	existing, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Check if project is locked
	if existing.IsLocked {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete a locked project. Unlock it first."})
		return
	}

	// Check for active workflows in this project
	activeStatus := domain.WorkflowStatusActive
	filter := repository.WorkflowFilter{
		ProjectID: &id,
		Status:    &activeStatus,
		Page:      1,
		PageSize:  1, // We only need to know if there's at least one
	}

	activeWorkflows, _, err := h.workflowRepo.GetAll(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check active workflows"})
		return
	}

	if len(activeWorkflows) > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Cannot delete project with active workflows. Deactivate all workflows first.",
			"details": map[string]interface{}{
				"activeWorkflowCount": len(activeWorkflows),
				"firstActiveWorkflow": activeWorkflows[0].Name,
			},
		})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete project"})
		return
	}

	c.Status(http.StatusNoContent)
}

// ToggleLock godoc
// @Summary Toggle project lock status
// @Description Lock or unlock a project
// @Tags projects
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Param body body object true "Lock status" example({"isLocked": true})
// @Success 200 {object} domain.Project
// @Router /projects/{id}/lock [post]
func (h *ProjectHandler) ToggleLock(c *gin.Context) {
	id := c.Param("id")

	var body struct {
		IsLocked bool `json:"isLocked"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get existing project
	existing, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Update only the lock status
	existing.IsLocked = body.IsLocked
	if err := h.repo.Update(c.Request.Context(), id, existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project lock status"})
		return
	}

	// Get updated project
	updated, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated project"})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// AddWorkflow godoc
// @Summary Add a workflow to a project
// @Description Add a new workflow to an existing project
// @Tags projects
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Param workflow body domain.Workflow true "Workflow data"
// @Success 201 {object} domain.Workflow
// @Router /projects/{id}/workflows [post]
func (h *ProjectHandler) AddWorkflow(c *gin.Context) {
	projectID := c.Param("id")

	// Check if project is locked
	project, err := h.repo.GetByID(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	if project.IsLocked {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot add workflow to a locked project."})
		return
	}

	var workflow domain.Workflow
	if err := c.ShouldBindJSON(&workflow); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context
	userID, _ := c.Get("userID")
	if userID != nil {
		workflow.CreatedBy = userID.(string)
	}

	// Set default status
	if workflow.Status == "" {
		workflow.Status = domain.WorkflowStatusDraft
	}

	if err := h.repo.AddWorkflow(c.Request.Context(), projectID, &workflow); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add workflow"})
		return
	}

	c.JSON(http.StatusCreated, workflow)
}

// GetWorkflow godoc
// @Summary Get a workflow from a project
// @Description Get a specific workflow from a project
// @Tags projects
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Param workflowId path string true "Workflow ID"
// @Success 200 {object} domain.Workflow
// @Router /projects/{id}/workflows/{workflowId} [get]
func (h *ProjectHandler) GetWorkflow(c *gin.Context) {
	projectID := c.Param("id")
	workflowID := c.Param("workflowId")

	workflow, err := h.repo.GetWorkflow(c.Request.Context(), projectID, workflowID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workflow not found"})
		return
	}

	c.JSON(http.StatusOK, workflow)
}

// UpdateWorkflow godoc
// @Summary Update a workflow in a project
// @Description Update an existing workflow in a project
// @Tags projects
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Param workflowId path string true "Workflow ID"
// @Param workflow body domain.Workflow true "Workflow data"
// @Success 200 {object} domain.Workflow
// @Router /projects/{id}/workflows/{workflowId} [put]
func (h *ProjectHandler) UpdateWorkflow(c *gin.Context) {
	projectID := c.Param("id")
	workflowID := c.Param("workflowId")

	// Check if project is locked
	project, err := h.repo.GetByID(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	if project.IsLocked {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot update workflow in a locked project."})
		return
	}

	var workflow domain.Workflow
	if err := c.ShouldBindJSON(&workflow); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.UpdateWorkflow(c.Request.Context(), projectID, workflowID, &workflow); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update workflow"})
		return
	}

	// Get updated workflow
	updated, err := h.repo.GetWorkflow(c.Request.Context(), projectID, workflowID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated workflow"})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// DeleteWorkflow godoc
// @Summary Delete a workflow from a project
// @Description Remove a workflow from a project
// @Tags projects
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Param workflowId path string true "Workflow ID"
// @Success 204
// @Router /projects/{id}/workflows/{workflowId} [delete]
func (h *ProjectHandler) DeleteWorkflow(c *gin.Context) {
	projectID := c.Param("id")
	workflowID := c.Param("workflowId")

	// Check if project is locked
	project, err := h.repo.GetByID(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	if project.IsLocked {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete workflow from a locked project."})
		return
	}

	if err := h.repo.DeleteWorkflow(c.Request.Context(), projectID, workflowID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete workflow"})
		return
	}

	c.Status(http.StatusNoContent)
}
