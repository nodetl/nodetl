package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/executor"
)

type WebhookHandler struct {
	flowExecutor *executor.FlowExecutor
}

func NewWebhookHandler(flowExecutor *executor.FlowExecutor) *WebhookHandler {
	return &WebhookHandler{flowExecutor: flowExecutor}
}

// HandleWebhook handles incoming webhook requests and triggers workflows
func (h *WebhookHandler) HandleWebhook(c *gin.Context) {
	// Extract path from URL
	path := c.Param("path")
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	
	// Execute with full path
	fullPath := "/webhook" + path
	h.executeWebhook(c, fullPath, "")
}

// HandleVersionedWebhook handles versioned API requests: /api/{version}/{custom-path}
func (h *WebhookHandler) HandleVersionedWebhook(c *gin.Context) {
	version := c.Param("version")
	path := c.Param("path")
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	
	// Build full path: /api/{version}/{path}
	fullPath := "/api/" + version + path
	h.executeWebhook(c, fullPath, version)
}

// executeWebhook is the common execution logic for both webhook types
func (h *WebhookHandler) executeWebhook(c *gin.Context, fullPath string, version string) {
	// Parse request body
	var input map[string]any
	if err := c.ShouldBindJSON(&input); err != nil {
		// Try to use empty input if no body
		input = make(map[string]any)
	}
	
	// Add request metadata
	input["_request"] = map[string]any{
		"method":  c.Request.Method,
		"path":    fullPath,
		"headers": headerMap(c.Request.Header),
		"query":   c.Request.URL.Query(),
		"ip":      c.ClientIP(),
		"version": version,
	}
	
	// Execute workflow
	result, err := h.flowExecutor.ExecuteByEndpoint(c.Request.Context(), fullPath, input)
	if err != nil {
		if strings.Contains(err.Error(), "no active workflow found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "workflow not found for this endpoint"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	// Check if output contains response configuration
	if result.Output != nil {
		// Get status code (default 200)
		statusCode := http.StatusOK
		if sc, ok := result.Output["statusCode"]; ok {
			switch v := sc.(type) {
			case int:
				statusCode = v
			case float64:
				statusCode = int(v)
			}
		}
		
		// Set headers from response config
		if headers, ok := result.Output["headers"].(map[string]any); ok {
			for key, value := range headers {
				if strVal, ok := value.(string); ok {
					c.Header(key, strVal)
				}
			}
		} else if headers, ok := result.Output["headers"].(map[string]string); ok {
			for key, value := range headers {
				c.Header(key, value)
			}
		}
		
		// Return body directly if present
		if body, ok := result.Output["body"]; ok {
			c.JSON(statusCode, body)
			return
		}
	}
	
	// Fallback: return full execution result
	c.JSON(http.StatusOK, gin.H{
		"executionId": result.ExecutionID,
		"status":      result.Status,
		"output":      result.Output,
		"duration":    result.Duration,
	})
}

func headerMap(headers map[string][]string) map[string]string {
	result := make(map[string]string)
	for key, values := range headers {
		if len(values) > 0 {
			result[key] = values[0]
		}
	}
	return result
}
