package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/service"
)

type AIHandler struct {
	aiService *service.AIService
}

func NewAIHandler(aiService *service.AIService) *AIHandler {
	return &AIHandler{aiService: aiService}
}

// GenerateTestDataRequest is the request body for generating test data
type GenerateTestDataRequest struct {
	SourceSchema map[string]any `json:"sourceSchema" binding:"required"`
	Description  string         `json:"description,omitempty"`
	Count        int            `json:"count,omitempty"`
}

// GetStatus returns AI service status
func (h *AIHandler) GetStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"enabled": h.aiService.IsEnabled(),
		"message": func() string {
			if h.aiService.IsEnabled() {
				return "AI service is configured and ready"
			}
			return "AI service is not configured. Set OPENAI_API_KEY to enable."
		}(),
	})
}

// GenerateTestData generates test data using AI
func (h *AIHandler) GenerateTestData(c *gin.Context) {
	var req GenerateTestDataRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.aiService.GenerateTestData(&service.GenerateTestDataRequest{
		SourceSchema: req.SourceSchema,
		Description:  req.Description,
		Count:        req.Count,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}
