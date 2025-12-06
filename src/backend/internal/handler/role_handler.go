package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// RoleHandler handles role management endpoints
type RoleHandler struct {
	roleRepo repository.RoleRepository
	userRepo repository.UserRepository
}

// NewRoleHandler creates a new role handler
func NewRoleHandler(roleRepo repository.RoleRepository, userRepo repository.UserRepository) *RoleHandler {
	return &RoleHandler{
		roleRepo: roleRepo,
		userRepo: userRepo,
	}
}

// ListRoles returns all roles
func (h *RoleHandler) ListRoles(c *gin.Context) {
	roles, err := h.roleRepo.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list roles"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": roles})
}

// GetRole returns a specific role
func (h *RoleHandler) GetRole(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role ID"})
		return
	}

	role, err := h.roleRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "role not found"})
		return
	}

	c.JSON(http.StatusOK, role)
}

// CreateRole creates a new role
func (h *RoleHandler) CreateRole(c *gin.Context) {
	var req domain.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	role := &domain.Role{
		Name:        req.Name,
		Description: req.Description,
		Permissions: req.Permissions,
		IsSystem:    false,
	}

	if err := h.roleRepo.Create(c.Request.Context(), role); err != nil {
		if err == repository.ErrRoleAlreadyExists {
			c.JSON(http.StatusConflict, gin.H{"error": "role with this name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create role"})
		return
	}

	c.JSON(http.StatusCreated, role)
}

// UpdateRole updates a role
func (h *RoleHandler) UpdateRole(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role ID"})
		return
	}

	var req domain.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	role, err := h.roleRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "role not found"})
		return
	}

	// Apply updates (system roles can only have permissions updated)
	if req.Name != nil && !role.IsSystem {
		role.Name = *req.Name
	}
	if req.Description != nil {
		role.Description = *req.Description
	}
	if req.Permissions != nil {
		role.Permissions = *req.Permissions
	}

	if err := h.roleRepo.Update(c.Request.Context(), role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update role"})
		return
	}

	c.JSON(http.StatusOK, role)
}

// DeleteRole deletes a role
func (h *RoleHandler) DeleteRole(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role ID"})
		return
	}

	// Check if any users have this role
	count, err := h.userRepo.CountByRoleID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check role usage"})
		return
	}

	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete role that is assigned to users"})
		return
	}

	if err := h.roleRepo.Delete(c.Request.Context(), id); err != nil {
		if err == repository.ErrRoleIsSystem {
			c.JSON(http.StatusForbidden, gin.H{"error": "cannot delete system role"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "role deleted successfully"})
}

// GetAllPermissions returns all available permissions
func (h *RoleHandler) GetAllPermissions(c *gin.Context) {
	permissions := domain.AllPermissions()
	
	// Group permissions by resource
	grouped := make(map[string][]string)
	for _, p := range permissions {
		pStr := string(p)
		// Extract resource from permission (e.g., "workflow" from "workflow:view")
		for i, c := range pStr {
			if c == ':' {
				resource := pStr[:i]
				grouped[resource] = append(grouped[resource], pStr)
				break
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"permissions": permissions,
		"grouped":     grouped,
	})
}
