package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/repository"
)

type VersionHandler struct {
	repo *repository.VersionRepository
}

func NewVersionHandler(repo *repository.VersionRepository) *VersionHandler {
	return &VersionHandler{repo: repo}
}

// ListVersions returns all versions
func (h *VersionHandler) ListVersions(c *gin.Context) {
	versions, err := h.repo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": versions})
}

// GetVersion returns a version by ID
func (h *VersionHandler) GetVersion(c *gin.Context) {
	id := c.Param("id")

	version, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Version not found"})
		return
	}

	c.JSON(http.StatusOK, version)
}

// CreateVersion creates a new version
func (h *VersionHandler) CreateVersion(c *gin.Context) {
	var version domain.Version
	if err := c.ShouldBindJSON(&version); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if tag already exists
	existing, _ := h.repo.GetByTag(c.Request.Context(), version.Tag)
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Version tag already exists"})
		return
	}

	if err := h.repo.Create(c.Request.Context(), &version); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, version)
}

// UpdateVersion updates an existing version
func (h *VersionHandler) UpdateVersion(c *gin.Context) {
	id := c.Param("id")

	var version domain.Version
	if err := c.ShouldBindJSON(&version); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.Update(c.Request.Context(), id, &version); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Fetch updated version
	updated, _ := h.repo.GetByID(c.Request.Context(), id)
	c.JSON(http.StatusOK, updated)
}

// DeleteVersion deletes a version
func (h *VersionHandler) DeleteVersion(c *gin.Context) {
	id := c.Param("id")

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Version deleted"})
}

// SetDefaultVersion sets a version as default
func (h *VersionHandler) SetDefaultVersion(c *gin.Context) {
	id := c.Param("id")

	if err := h.repo.SetDefault(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Default version set"})
}
