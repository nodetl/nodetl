package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/repository"
)

type NodeTypeHandler struct {
	repo repository.NodeTypeRepository
}

func NewNodeTypeHandler(repo repository.NodeTypeRepository) *NodeTypeHandler {
	return &NodeTypeHandler{repo: repo}
}

// ListNodeTypes returns all available node types
func (h *NodeTypeHandler) ListNodeTypes(c *gin.Context) {
	filter := repository.NodeTypeFilter{}
	
	if category := c.Query("category"); category != "" {
		filter.Category = &category
	}
	if builtIn := c.Query("builtIn"); builtIn != "" {
		isBuiltIn := builtIn == "true"
		filter.IsBuiltIn = &isBuiltIn
	}
	
	nodeTypes, err := h.repo.GetAll(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, nodeTypes)
}

// CreateCustomNodeType creates a custom node type
func (h *NodeTypeHandler) CreateCustomNodeType(c *gin.Context) {
	var nodeType domain.NodeType
	if err := c.ShouldBindJSON(&nodeType); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	nodeType.IsBuiltIn = false
	nodeType.Category = domain.CategoryCustom
	
	// Ensure type starts with "custom_"
	if len(nodeType.Type) < 7 || nodeType.Type[:7] != "custom_" {
		nodeType.Type = "custom_" + nodeType.Type
	}
	
	if err := h.repo.Create(c.Request.Context(), &nodeType); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusCreated, nodeType)
}

// GetBuiltInNodeTypes returns all built-in node types
func (h *NodeTypeHandler) GetBuiltInNodeTypes(c *gin.Context) {
	builtIn := domain.GetBuiltInNodeTypes()
	c.JSON(http.StatusOK, builtIn)
}
