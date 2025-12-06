package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type SchemaHandler struct {
	repo repository.SchemaRepository
}

func NewSchemaHandler(repo repository.SchemaRepository) *SchemaHandler {
	return &SchemaHandler{repo: repo}
}

// CreateSchema creates a new schema
func (h *SchemaHandler) CreateSchema(c *gin.Context) {
	var schema domain.Schema
	if err := c.ShouldBindJSON(&schema); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	schema.Type = domain.SchemaTypeCustom
	
	if err := h.repo.Create(c.Request.Context(), &schema); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusCreated, schema)
}

// GetSchema gets a schema by ID
func (h *SchemaHandler) GetSchema(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid schema ID"})
		return
	}
	
	schema, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if schema == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "schema not found"})
		return
	}
	
	c.JSON(http.StatusOK, schema)
}

// ListSchemas lists all schemas
func (h *SchemaHandler) ListSchemas(c *gin.Context) {
	filter := repository.SchemaFilter{
		Page:     1,
		PageSize: 100,
	}
	
	if schemaType := c.Query("type"); schemaType != "" {
		t := domain.SchemaType(schemaType)
		filter.Type = &t
	}
	if category := c.Query("category"); category != "" {
		filter.Category = &category
	}
	
	schemas, total, err := h.repo.GetAll(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"data":  schemas,
		"total": total,
	})
}

// UpdateSchema updates a schema
func (h *SchemaHandler) UpdateSchema(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid schema ID"})
		return
	}
	
	existing, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "schema not found"})
		return
	}
	
	// Cannot modify predefined schemas
	if existing.Type == domain.SchemaTypePredefined {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot modify predefined schema"})
		return
	}
	
	var schema domain.Schema
	if err := c.ShouldBindJSON(&schema); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	schema.ID = id
	schema.Type = existing.Type
	schema.CreatedAt = existing.CreatedAt
	schema.CreatedBy = existing.CreatedBy
	
	if err := h.repo.Update(c.Request.Context(), &schema); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, schema)
}

// DeleteSchema deletes a schema
func (h *SchemaHandler) DeleteSchema(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid schema ID"})
		return
	}
	
	existing, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "schema not found"})
		return
	}
	
	// Cannot delete predefined schemas
	if existing.Type == domain.SchemaTypePredefined {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot delete predefined schema"})
		return
	}
	
	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "schema deleted"})
}

// GetPredefinedSchemas returns all predefined schemas
func (h *SchemaHandler) GetPredefinedSchemas(c *gin.Context) {
	predefined := domain.GetPredefinedSchemas()
	c.JSON(http.StatusOK, predefined)
}
