package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/executor"
	"github.com/nodetl/nodetl/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ExecutionHandler struct {
	repo         repository.ExecutionRepository
	workflowRepo repository.WorkflowRepository
	flowExecutor *executor.FlowExecutor
}

func NewExecutionHandler(
	repo repository.ExecutionRepository,
	workflowRepo repository.WorkflowRepository,
	flowExecutor *executor.FlowExecutor,
) *ExecutionHandler {
	return &ExecutionHandler{
		repo:         repo,
		workflowRepo: workflowRepo,
		flowExecutor: flowExecutor,
	}
}

// ExecuteRequest is the request body for manual workflow execution
type ExecuteRequest struct {
	Input    map[string]any `json:"input"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

// ExecuteWorkflow manually executes a workflow
func (h *ExecutionHandler) ExecuteWorkflow(c *gin.Context) {
	workflowID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workflow ID"})
		return
	}

	var req ExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Allow empty body
		req.Input = make(map[string]any)
	}

	result, err := h.flowExecutor.Execute(c.Request.Context(), &executor.ExecuteRequest{
		WorkflowID:  workflowID,
		TriggerType: "manual",
		Input:       req.Input,
		Metadata:    req.Metadata,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetExecution gets an execution by ID
func (h *ExecutionHandler) GetExecution(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid execution ID"})
		return
	}

	execution, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if execution == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "execution not found"})
		return
	}

	c.JSON(http.StatusOK, execution)
}

// ListExecutions lists executions for a workflow
func (h *ExecutionHandler) ListExecutions(c *gin.Context) {
	workflowID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workflow ID"})
		return
	}

	executions, total, err := h.repo.GetByWorkflowID(c.Request.Context(), workflowID, 1, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  executions,
		"total": total,
	})
}

// GetLatestExecutions gets the latest executions for a workflow
func (h *ExecutionHandler) GetLatestExecutions(c *gin.Context) {
	workflowID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workflow ID"})
		return
	}

	executions, err := h.repo.GetLatest(c.Request.Context(), workflowID, 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, executions)
}

// ListExecutionsByProject lists all executions for workflows in a project
func (h *ExecutionHandler) ListExecutionsByProject(c *gin.Context) {
	projectIDStr := c.Param("id")
	// Validate it's a valid ObjectID format
	if _, err := primitive.ObjectIDFromHex(projectIDStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project ID"})
		return
	}

	// Parse pagination params
	page := 1
	pageSize := 50
	if p := c.Query("page"); p != "" {
		if val, err := strconv.Atoi(p); err == nil && val > 0 {
			page = val
		}
	}
	if ps := c.Query("pageSize"); ps != "" {
		if val, err := strconv.Atoi(ps); err == nil && val > 0 && val <= 100 {
			pageSize = val
		}
	}

	// Get all workflows in this project
	filter := repository.WorkflowFilter{
		ProjectID: &projectIDStr,
		Page:      1,
		PageSize:  1000, // Get all workflows in project
	}
	workflows, _, err := h.workflowRepo.GetAll(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Collect workflow IDs
	workflowIDs := make([]primitive.ObjectID, len(workflows))
	for i, w := range workflows {
		workflowIDs[i] = w.ID
	}

	// Get executions for all these workflows
	executions, total, err := h.repo.GetByWorkflowIDs(c.Request.Context(), workflowIDs, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":       executions,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}
