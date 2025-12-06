package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/repository"
	"github.com/nodetl/nodetl/pkg/ai"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type MappingHandler struct {
	repo          repository.MappingRepository
	schemaRepo    repository.SchemaRepository
	mappingService *ai.MappingService
}

func NewMappingHandler(
	repo repository.MappingRepository,
	schemaRepo repository.SchemaRepository,
	mappingService *ai.MappingService,
) *MappingHandler {
	return &MappingHandler{
		repo:          repo,
		schemaRepo:    schemaRepo,
		mappingService: mappingService,
	}
}

// SuggestMappingRequest is the request body for AI mapping suggestion
type SuggestMappingRequest struct {
	SourceSchemaID string         `json:"sourceSchemaId" binding:"required"`
	TargetSchemaID string         `json:"targetSchemaId" binding:"required"`
	SampleData     map[string]any `json:"sampleData,omitempty"`
	Instructions   string         `json:"instructions,omitempty"`
}

// SuggestMapping uses AI to suggest field mappings
func (h *MappingHandler) SuggestMapping(c *gin.Context) {
	var req SuggestMappingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Get source schema
	sourceID, err := primitive.ObjectIDFromHex(req.SourceSchemaID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid source schema ID"})
		return
	}
	sourceSchema, err := h.schemaRepo.GetByID(c.Request.Context(), sourceID)
	if err != nil || sourceSchema == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "source schema not found"})
		return
	}
	
	// Get target schema
	targetID, err := primitive.ObjectIDFromHex(req.TargetSchemaID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid target schema ID"})
		return
	}
	targetSchema, err := h.schemaRepo.GetByID(c.Request.Context(), targetID)
	if err != nil || targetSchema == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "target schema not found"})
		return
	}
	
	// Call AI mapping service
	aiReq := &domain.AIMappingRequest{
		SourceSchema: *sourceSchema,
		TargetSchema: *targetSchema,
		SampleData:   req.SampleData,
		Instructions: req.Instructions,
	}
	
	response, err := h.mappingService.SuggestMapping(c.Request.Context(), aiReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, response)
}

// SaveMapping saves a field mapping configuration
func (h *MappingHandler) SaveMapping(c *gin.Context) {
	var mapping domain.FieldMapping
	if err := c.ShouldBindJSON(&mapping); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	if err := h.repo.Create(c.Request.Context(), &mapping); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusCreated, mapping)
}

// GetMapping gets a mapping by ID
func (h *MappingHandler) GetMapping(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid mapping ID"})
		return
	}
	
	mapping, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if mapping == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "mapping not found"})
		return
	}
	
	c.JSON(http.StatusOK, mapping)
}

// ListMappings lists all mappings
func (h *MappingHandler) ListMappings(c *gin.Context) {
	mappings, total, err := h.repo.GetAll(c.Request.Context(), 1, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"data":  mappings,
		"total": total,
	})
}

// UpdateMapping updates a mapping
func (h *MappingHandler) UpdateMapping(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid mapping ID"})
		return
	}
	
	existing, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "mapping not found"})
		return
	}
	
	var mapping domain.FieldMapping
	if err := c.ShouldBindJSON(&mapping); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	mapping.ID = id
	mapping.CreatedAt = existing.CreatedAt
	mapping.CreatedBy = existing.CreatedBy
	
	if err := h.repo.Update(c.Request.Context(), &mapping); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, mapping)
}

// DeleteMapping deletes a mapping
func (h *MappingHandler) DeleteMapping(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid mapping ID"})
		return
	}
	
	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "mapping deleted"})
}
