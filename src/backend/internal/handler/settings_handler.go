package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/middleware"
	"github.com/nodetl/nodetl/internal/repository"
)

// SettingsHandler handles app settings endpoints
type SettingsHandler struct {
	settingsRepo repository.SettingsRepository
}

// NewSettingsHandler creates a new settings handler
func NewSettingsHandler(settingsRepo repository.SettingsRepository) *SettingsHandler {
	return &SettingsHandler{settingsRepo: settingsRepo}
}

// GetSettings returns the current app settings (public)
func (h *SettingsHandler) GetSettings(c *gin.Context) {
	settings, err := h.settingsRepo.Get(c.Request.Context())
	if err != nil {
		// Return defaults if not found
		defaults := domain.DefaultSettings()
		c.JSON(http.StatusOK, defaults.ToPublic())
		return
	}

	c.JSON(http.StatusOK, settings.ToPublic())
}

// GetFullSettings returns full settings (admin only)
func (h *SettingsHandler) GetFullSettings(c *gin.Context) {
	settings, err := h.settingsRepo.Get(c.Request.Context())
	if err != nil {
		// Return defaults if not found
		defaults := domain.DefaultSettings()
		c.JSON(http.StatusOK, defaults)
		return
	}

	c.JSON(http.StatusOK, settings)
}

// UpdateSettings updates app settings (admin only)
func (h *SettingsHandler) UpdateSettings(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	var req domain.UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current settings or create new
	settings, err := h.settingsRepo.Get(c.Request.Context())
	if err != nil {
		settings = &domain.AppSettings{}
	}

	// Apply updates
	if req.ProjectName != nil {
		settings.ProjectName = *req.ProjectName
	}
	if req.LogoURL != nil {
		settings.LogoURL = *req.LogoURL
	}
	if req.FaviconURL != nil {
		settings.FaviconURL = *req.FaviconURL
	}
	if req.PrimaryColor != nil {
		settings.PrimaryColor = *req.PrimaryColor
	}
	if req.SecondaryColor != nil {
		settings.SecondaryColor = *req.SecondaryColor
	}

	settings.UpdatedAt = time.Now()
	settings.UpdatedBy = userID

	if err := h.settingsRepo.Upsert(c.Request.Context(), settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update settings"})
		return
	}

	c.JSON(http.StatusOK, settings)
}
