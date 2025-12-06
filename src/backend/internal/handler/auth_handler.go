package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/middleware"
	"github.com/nodetl/nodetl/internal/service"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	authService *service.AuthService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Login handles user login
func (h *AuthHandler) Login(c *gin.Context) {
	var req domain.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userAgent := c.GetHeader("User-Agent")
	ipAddress := c.ClientIP()

	response, err := h.authService.Login(c.Request.Context(), req.Email, req.Password, userAgent, ipAddress)
	if err != nil {
		switch err {
		case service.ErrInvalidCredentials:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		case service.ErrUserNotActive:
			c.JSON(http.StatusForbidden, gin.H{"error": "account is not active"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "login failed"})
		}
		return
	}

	c.JSON(http.StatusOK, response)
}

// RefreshToken handles token refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req domain.RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userAgent := c.GetHeader("User-Agent")
	ipAddress := c.ClientIP()

	tokens, err := h.authService.RefreshTokens(c.Request.Context(), req.RefreshToken, userAgent, ipAddress)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
		return
	}

	c.JSON(http.StatusOK, domain.RefreshTokenResponse{Tokens: *tokens})
}

// Logout handles user logout
func (h *AuthHandler) Logout(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	if err := h.authService.Logout(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "logout failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

// GetMe returns the current user's information
func (h *AuthHandler) GetMe(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	user, err := h.authService.GetCurrentUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// UpdatePreferences updates user preferences (theme, etc.)
func (h *AuthHandler) UpdatePreferences(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req domain.UpdatePreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.authService.UpdatePreferences(c.Request.Context(), userID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update preferences"})
		return
	}

	// Return updated user
	user, err := h.authService.GetCurrentUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "preferences updated"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// ChangePassword handles password change
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req domain.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.authService.ChangePassword(c.Request.Context(), userID, req.CurrentPassword, req.NewPassword); err != nil {
		if err == service.ErrInvalidCredentials {
			c.JSON(http.StatusBadRequest, gin.H{"error": "current password is incorrect"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to change password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "password changed successfully"})
}

// GoogleAuth redirects to Google OAuth
func (h *AuthHandler) GoogleAuth(c *gin.Context) {
	state := c.Query("state")
	if state == "" {
		state = "nodetl-oauth"
	}

	url, err := h.authService.GetGoogleAuthURL(state)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Google OAuth not configured"})
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, url)
}

// GoogleCallback handles Google OAuth callback
func (h *AuthHandler) GoogleCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "authorization code required"})
		return
	}

	userAgent := c.GetHeader("User-Agent")
	ipAddress := c.ClientIP()

	response, err := h.authService.HandleGoogleCallback(c.Request.Context(), code, userAgent, ipAddress)
	if err != nil {
		switch err {
		case service.ErrUserNotInvited:
			c.JSON(http.StatusForbidden, gin.H{"error": "you have not been invited to this application"})
		case service.ErrUserNotActive:
			c.JSON(http.StatusForbidden, gin.H{"error": "account is not active"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "authentication failed"})
		}
		return
	}

	// Redirect to frontend with tokens (in production, use a more secure method)
	c.Redirect(http.StatusTemporaryRedirect,
		"/auth/callback?accessToken="+response.Tokens.AccessToken+
			"&refreshToken="+response.Tokens.RefreshToken)
}

// MicrosoftAuth redirects to Microsoft OAuth
func (h *AuthHandler) MicrosoftAuth(c *gin.Context) {
	state := c.Query("state")
	if state == "" {
		state = "nodetl-oauth"
	}

	url, err := h.authService.GetMicrosoftAuthURL(state)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Microsoft OAuth not configured"})
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, url)
}

// MicrosoftCallback handles Microsoft OAuth callback
func (h *AuthHandler) MicrosoftCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "authorization code required"})
		return
	}

	userAgent := c.GetHeader("User-Agent")
	ipAddress := c.ClientIP()

	response, err := h.authService.HandleMicrosoftCallback(c.Request.Context(), code, userAgent, ipAddress)
	if err != nil {
		switch err {
		case service.ErrUserNotInvited:
			c.JSON(http.StatusForbidden, gin.H{"error": "you have not been invited to this application"})
		case service.ErrUserNotActive:
			c.JSON(http.StatusForbidden, gin.H{"error": "account is not active"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "authentication failed"})
		}
		return
	}

	c.Redirect(http.StatusTemporaryRedirect,
		"/auth/callback?accessToken="+response.Tokens.AccessToken+
			"&refreshToken="+response.Tokens.RefreshToken)
}

// GetOAuthProviders returns available OAuth providers
func (h *AuthHandler) GetOAuthProviders(c *gin.Context) {
	providers := []string{}

	if _, err := h.authService.GetGoogleAuthURL("test"); err == nil {
		providers = append(providers, "google")
	}
	if _, err := h.authService.GetMicrosoftAuthURL("test"); err == nil {
		providers = append(providers, "microsoft")
	}

	c.JSON(http.StatusOK, gin.H{"providers": providers})
}
