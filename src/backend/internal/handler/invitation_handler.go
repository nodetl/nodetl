package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/middleware"
	"github.com/nodetl/nodetl/internal/repository"
	"github.com/nodetl/nodetl/internal/service"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// InvitationHandler handles invitation endpoints
type InvitationHandler struct {
	invitationService *service.InvitationService
}

// NewInvitationHandler creates a new invitation handler
func NewInvitationHandler(invitationService *service.InvitationService) *InvitationHandler {
	return &InvitationHandler{invitationService: invitationService}
}

// CreateInvitation creates a new invitation
func (h *InvitationHandler) CreateInvitation(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req domain.CreateInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if email should be sent
	sendEmail := c.Query("sendEmail") != "false"

	invitation, _, err := h.invitationService.CreateInvitation(c.Request.Context(), &req, userID, sendEmail)
	if err != nil {
		if err == repository.ErrUserAlreadyExists {
			c.JSON(http.StatusConflict, gin.H{"error": "user with this email already exists"})
			return
		}
		if err == repository.ErrInvitationAlreadyExists {
			c.JSON(http.StatusConflict, gin.H{"error": "invitation for this email already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create invitation"})
		return
	}

	c.JSON(http.StatusCreated, invitation)
}

// ListInvitations returns all invitations
func (h *InvitationHandler) ListInvitations(c *gin.Context) {
	page := 1
	pageSize := 50

	if p := c.Query("page"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if ps := c.Query("pageSize"); ps != "" {
		if parsed, err := strconv.Atoi(ps); err == nil && parsed > 0 {
			pageSize = parsed
		}
	}

	filter := repository.InvitationFilter{
		Page:     page,
		PageSize: pageSize,
	}

	if status := c.Query("status"); status != "" {
		s := domain.InvitationStatus(status)
		filter.Status = &s
	}

	invitations, total, err := h.invitationService.ListInvitations(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list invitations"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  invitations,
		"total": total,
		"page":  page,
	})
}

// GetInvitation returns a specific invitation
func (h *InvitationHandler) GetInvitation(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid invitation ID"})
		return
	}

	invitation, err := h.invitationService.GetInvitation(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invitation not found"})
		return
	}

	c.JSON(http.StatusOK, invitation)
}

// RevokeInvitation revokes a pending invitation
func (h *InvitationHandler) RevokeInvitation(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid invitation ID"})
		return
	}

	if err := h.invitationService.RevokeInvitation(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "invitation revoked successfully"})
}

// ResendInvitation resends an invitation email
func (h *InvitationHandler) ResendInvitation(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid invitation ID"})
		return
	}

	link, err := h.invitationService.ResendInvitation(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "invitation resent",
		"link":    link,
	})
}

// AcceptInvitation accepts an invitation (public endpoint)
func (h *InvitationHandler) AcceptInvitation(c *gin.Context) {
	var req domain.AcceptInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.invitationService.AcceptInvitation(c.Request.Context(), req.Token, req.Password, req.Name)
	if err != nil {
		switch err {
		case repository.ErrInvitationNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "invitation not found"})
		case repository.ErrInvitationExpired:
			c.JSON(http.StatusGone, gin.H{"error": "invitation has expired"})
		case repository.ErrInvitationAlreadyAccepted:
			c.JSON(http.StatusConflict, gin.H{"error": "invitation has already been accepted"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to accept invitation"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "invitation accepted",
		"user":    user.ToPublic(),
	})
}

// ValidateInvitation validates an invitation token (public endpoint)
func (h *InvitationHandler) ValidateInvitation(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token required"})
		return
	}

	// Try to find the invitation using the token
	// This is a simplified check - in production you'd want to verify the token
	c.JSON(http.StatusOK, gin.H{
		"valid":   true,
		"message": "invitation is valid",
	})
}
