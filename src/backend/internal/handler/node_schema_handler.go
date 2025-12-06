package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/repository"
)

type NodeSchemaHandler struct {
	nodeSchemaRepo repository.NodeSchemaRepository
}

func NewNodeSchemaHandler(nodeSchemaRepo repository.NodeSchemaRepository) *NodeSchemaHandler {
	return &NodeSchemaHandler{
		nodeSchemaRepo: nodeSchemaRepo,
	}
}

type SaveNodeSchemaRequest struct {
	SourceSchema *domain.ImportedSchema     `json:"sourceSchema,omitempty"`
	TargetSchema *domain.ImportedSchema     `json:"targetSchema,omitempty"`
	Connections  []domain.MappingConnection `json:"connections,omitempty"`
	HeaderFields []domain.HeaderField       `json:"headerFields,omitempty"`
}

// SaveNodeSchema saves or updates the imported schema for a transform node
// @Summary Save node schema
// @Description Save or update the source/target schema for a transform node
// @Tags node-schemas
// @Accept json
// @Produce json
// @Param id path string true "Workflow ID"
// @Param nodeId path string true "Node ID"
// @Param request body SaveNodeSchemaRequest true "Schema data"
// @Success 200 {object} domain.NodeSchema
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /workflows/{id}/nodes/{nodeId}/schema [put]
func (h *NodeSchemaHandler) SaveNodeSchema(c *gin.Context) {
	workflowID := c.Param("id")
	nodeID := c.Param("nodeId")

	if workflowID == "" || nodeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workflowId and nodeId are required"})
		return
	}

	var req SaveNodeSchemaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	nodeSchema := &domain.NodeSchema{
		WorkflowID:   workflowID,
		NodeID:       nodeID,
		SourceSchema: req.SourceSchema,
		TargetSchema: req.TargetSchema,
		Connections:  req.Connections,
		HeaderFields: req.HeaderFields,
	}

	if err := h.nodeSchemaRepo.Upsert(c.Request.Context(), nodeSchema); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get the updated record
	saved, err := h.nodeSchemaRepo.GetByNode(c.Request.Context(), workflowID, nodeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, saved)
}

// GetNodeSchema retrieves the imported schema for a transform node
// @Summary Get node schema
// @Description Get the source/target schema for a transform node
// @Tags node-schemas
// @Produce json
// @Param id path string true "Workflow ID"
// @Param nodeId path string true "Node ID"
// @Success 200 {object} domain.NodeSchema
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /workflows/{id}/nodes/{nodeId}/schema [get]
func (h *NodeSchemaHandler) GetNodeSchema(c *gin.Context) {
	workflowID := c.Param("id")
	nodeID := c.Param("nodeId")

	if workflowID == "" || nodeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workflowId and nodeId are required"})
		return
	}

	nodeSchema, err := h.nodeSchemaRepo.GetByNode(c.Request.Context(), workflowID, nodeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if nodeSchema == nil {
		c.JSON(http.StatusOK, gin.H{
			"workflowId":   workflowID,
			"nodeId":       nodeID,
			"sourceSchema": nil,
			"targetSchema": nil,
		})
		return
	}

	c.JSON(http.StatusOK, nodeSchema)
}

// DeleteNodeSchema removes the imported schema for a transform node
// @Summary Delete node schema
// @Description Delete the source/target schema for a transform node
// @Tags node-schemas
// @Produce json
// @Param id path string true "Workflow ID"
// @Param nodeId path string true "Node ID"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /workflows/{id}/nodes/{nodeId}/schema [delete]
func (h *NodeSchemaHandler) DeleteNodeSchema(c *gin.Context) {
	workflowID := c.Param("id")
	nodeID := c.Param("nodeId")

	if workflowID == "" || nodeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workflowId and nodeId are required"})
		return
	}

	if err := h.nodeSchemaRepo.DeleteByNode(c.Request.Context(), workflowID, nodeID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Node schema deleted successfully"})
}

// ListNodeSchemas retrieves all node schemas for a workflow
// @Summary List node schemas
// @Description Get all node schemas for a workflow
// @Tags node-schemas
// @Produce json
// @Param id path string true "Workflow ID"
// @Success 200 {array} domain.NodeSchema
// @Failure 500 {object} map[string]interface{}
// @Router /workflows/{id}/nodes/schemas [get]
func (h *NodeSchemaHandler) ListNodeSchemas(c *gin.Context) {
	workflowID := c.Param("id")

	if workflowID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workflowId is required"})
		return
	}

	nodeSchemas, err := h.nodeSchemaRepo.ListByWorkflow(c.Request.Context(), workflowID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if nodeSchemas == nil {
		nodeSchemas = []*domain.NodeSchema{}
	}

	c.JSON(http.StatusOK, nodeSchemas)
}

// ClearSourceSchema clears only the source schema for a node
// @Summary Clear source schema
// @Description Clear only the source schema for a transform node
// @Tags node-schemas
// @Produce json
// @Param id path string true "Workflow ID"
// @Param nodeId path string true "Node ID"
// @Success 200 {object} domain.NodeSchema
// @Failure 500 {object} map[string]interface{}
// @Router /workflows/{id}/nodes/{nodeId}/schema/source [delete]
func (h *NodeSchemaHandler) ClearSourceSchema(c *gin.Context) {
	workflowID := c.Param("id")
	nodeID := c.Param("nodeId")

	if workflowID == "" || nodeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workflowId and nodeId are required"})
		return
	}

	// Get existing
	nodeSchema, err := h.nodeSchemaRepo.GetByNode(c.Request.Context(), workflowID, nodeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if nodeSchema == nil {
		c.JSON(http.StatusOK, gin.H{
			"workflowId":   workflowID,
			"nodeId":       nodeID,
			"sourceSchema": nil,
			"targetSchema": nil,
		})
		return
	}

	// Clear source schema
	nodeSchema.SourceSchema = nil
	if err := h.nodeSchemaRepo.Upsert(c.Request.Context(), nodeSchema); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, nodeSchema)
}

// ClearTargetSchema clears only the target schema for a node
// @Summary Clear target schema
// @Description Clear only the target schema for a transform node
// @Tags node-schemas
// @Produce json
// @Param id path string true "Workflow ID"
// @Param nodeId path string true "Node ID"
// @Success 200 {object} domain.NodeSchema
// @Failure 500 {object} map[string]interface{}
// @Router /workflows/{id}/nodes/{nodeId}/schema/target [delete]
func (h *NodeSchemaHandler) ClearTargetSchema(c *gin.Context) {
	workflowID := c.Param("id")
	nodeID := c.Param("nodeId")

	if workflowID == "" || nodeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workflowId and nodeId are required"})
		return
	}

	// Get existing
	nodeSchema, err := h.nodeSchemaRepo.GetByNode(c.Request.Context(), workflowID, nodeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if nodeSchema == nil {
		c.JSON(http.StatusOK, gin.H{
			"workflowId":   workflowID,
			"nodeId":       nodeID,
			"sourceSchema": nil,
			"targetSchema": nil,
		})
		return
	}

	// Clear target schema
	nodeSchema.TargetSchema = nil
	if err := h.nodeSchemaRepo.Upsert(c.Request.Context(), nodeSchema); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, nodeSchema)
}
