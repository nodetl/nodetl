package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/middleware"
	"github.com/nodetl/nodetl/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// UserHandler handles user management endpoints
type UserHandler struct {
	userRepo repository.UserRepository
	roleRepo repository.RoleRepository
}

// NewUserHandler creates a new user handler
func NewUserHandler(userRepo repository.UserRepository, roleRepo repository.RoleRepository) *UserHandler {
	return &UserHandler{
		userRepo: userRepo,
		roleRepo: roleRepo,
	}
}

// ListUsers returns all users
func (h *UserHandler) ListUsers(c *gin.Context) {
	page := 1
	pageSize := 50

	if p := c.Query("page"); p != "" {
		if parsed, err := parseInt(p); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if ps := c.Query("pageSize"); ps != "" {
		if parsed, err := parseInt(ps); err == nil && parsed > 0 {
			pageSize = parsed
		}
	}

	filter := repository.UserFilter{
		Page:     page,
		PageSize: pageSize,
	}

	if status := c.Query("status"); status != "" {
		s := domain.UserStatus(status)
		filter.Status = &s
	}

	if roleID := c.Query("roleId"); roleID != "" {
		if id, err := primitive.ObjectIDFromHex(roleID); err == nil {
			filter.RoleID = &id
		}
	}

	if email := c.Query("email"); email != "" {
		filter.Email = &email
	}

	users, total, err := h.userRepo.GetAll(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list users"})
		return
	}

	// Convert to public users
	publicUsers := make([]domain.PublicUser, len(users))
	for i, u := range users {
		publicUsers[i] = u.ToPublic()
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  publicUsers,
		"total": total,
		"page":  page,
	})
}

// GetUser returns a specific user
func (h *UserHandler) GetUser(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, user.ToPublic())
}

// UpdateUser updates a user (admin only)
func (h *UserHandler) UpdateUser(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	var req domain.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Apply updates
	if req.Name != nil {
		user.Name = *req.Name
	}
	if req.FirstName != nil {
		user.FirstName = *req.FirstName
	}
	if req.LastName != nil {
		user.LastName = *req.LastName
	}
	if req.Avatar != nil {
		user.Avatar = *req.Avatar
	}
	if req.Status != nil {
		user.Status = *req.Status
	}
	if req.RoleID != nil {
		// Validate role exists
		if _, err := h.roleRepo.GetByID(c.Request.Context(), *req.RoleID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role ID"})
			return
		}
		user.RoleID = *req.RoleID
	}
	if req.ThemePreference != nil {
		user.ThemePreference = *req.ThemePreference
	}

	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
		return
	}

	c.JSON(http.StatusOK, user.ToPublic())
}

// DeleteUser deletes a user (admin only)
func (h *UserHandler) DeleteUser(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	// Prevent self-deletion
	currentUserID, _ := middleware.GetUserID(c)
	if id == currentUserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete your own account"})
		return
	}

	if err := h.userRepo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user deleted successfully"})
}

// parseInt helper
func parseInt(s string) (int, error) {
	var n int
	_, err := parseNumber(s, &n)
	return n, err
}

func parseNumber(s string, n *int) (bool, error) {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false, nil
		}
		*n = *n*10 + int(c-'0')
	}
	return true, nil
}
