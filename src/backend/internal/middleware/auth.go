package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/pkg/auth"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Context keys for storing auth information
const (
	ContextKeyUserID      = "userID"
	ContextKeyUserEmail   = "userEmail"
	ContextKeyUserName    = "userName"
	ContextKeyPermissions = "permissions"
	ContextKeyTheme       = "theme"
)

// AuthMiddleware validates JWT tokens and sets user context
func AuthMiddleware(jwtManager *auth.JWTManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Validate token
		claims, err := jwtManager.ValidateAccessToken(tokenString)
		if err != nil {
			switch err {
			case auth.ErrExpiredToken:
				c.JSON(http.StatusUnauthorized, gin.H{"error": "token expired"})
			default:
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			}
			c.Abort()
			return
		}

		// Parse user ID
		userID, err := primitive.ObjectIDFromHex(claims.UserID)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user ID in token"})
			c.Abort()
			return
		}

		// Set user context
		c.Set(ContextKeyUserID, userID)
		c.Set(ContextKeyUserEmail, claims.Email)
		c.Set(ContextKeyUserName, claims.Name)
		c.Set(ContextKeyPermissions, claims.Permissions)
		c.Set(ContextKeyTheme, claims.ThemePreference)

		c.Next()
	}
}

// OptionalAuthMiddleware extracts user info if present, but doesn't require auth
func OptionalAuthMiddleware(jwtManager *auth.JWTManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.Next()
			return
		}

		tokenString := parts[1]
		claims, err := jwtManager.ValidateAccessToken(tokenString)
		if err != nil {
			c.Next()
			return
		}

		userID, err := primitive.ObjectIDFromHex(claims.UserID)
		if err != nil {
			c.Next()
			return
		}

		c.Set(ContextKeyUserID, userID)
		c.Set(ContextKeyUserEmail, claims.Email)
		c.Set(ContextKeyUserName, claims.Name)
		c.Set(ContextKeyPermissions, claims.Permissions)
		c.Set(ContextKeyTheme, claims.ThemePreference)

		c.Next()
	}
}

// RequirePermission checks if the user has the required permission
func RequirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		permissions, exists := c.Get(ContextKeyPermissions)
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "no permissions found"})
			c.Abort()
			return
		}

		permList, ok := permissions.([]string)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "invalid permissions format"})
			c.Abort()
			return
		}

		for _, p := range permList {
			if p == permission {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions", "required": permission})
		c.Abort()
	}
}

// RequireAnyPermission checks if the user has any of the required permissions
func RequireAnyPermission(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userPermissions, exists := c.Get(ContextKeyPermissions)
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "no permissions found"})
			c.Abort()
			return
		}

		permList, ok := userPermissions.([]string)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "invalid permissions format"})
			c.Abort()
			return
		}

		for _, required := range permissions {
			for _, p := range permList {
				if p == required {
					c.Next()
					return
				}
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions", "required": permissions})
		c.Abort()
	}
}

// RequireAllPermissions checks if the user has all of the required permissions
func RequireAllPermissions(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userPermissions, exists := c.Get(ContextKeyPermissions)
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "no permissions found"})
			c.Abort()
			return
		}

		permList, ok := userPermissions.([]string)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "invalid permissions format"})
			c.Abort()
			return
		}

		permMap := make(map[string]bool)
		for _, p := range permList {
			permMap[p] = true
		}

		for _, required := range permissions {
			if !permMap[required] {
				c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions", "missing": required})
				c.Abort()
				return
			}
		}

		c.Next()
	}
}

// GetUserID retrieves the user ID from context
func GetUserID(c *gin.Context) (primitive.ObjectID, bool) {
	userID, exists := c.Get(ContextKeyUserID)
	if !exists {
		return primitive.NilObjectID, false
	}
	id, ok := userID.(primitive.ObjectID)
	return id, ok
}

// GetUserEmail retrieves the user email from context
func GetUserEmail(c *gin.Context) (string, bool) {
	email, exists := c.Get(ContextKeyUserEmail)
	if !exists {
		return "", false
	}
	e, ok := email.(string)
	return e, ok
}

// GetUserName retrieves the user name from context
func GetUserName(c *gin.Context) (string, bool) {
	name, exists := c.Get(ContextKeyUserName)
	if !exists {
		return "", false
	}
	n, ok := name.(string)
	return n, ok
}

// GetPermissions retrieves the user permissions from context
func GetPermissions(c *gin.Context) ([]string, bool) {
	permissions, exists := c.Get(ContextKeyPermissions)
	if !exists {
		return nil, false
	}
	perms, ok := permissions.([]string)
	return perms, ok
}

// HasPermission checks if the current user has a specific permission
func HasPermission(c *gin.Context, permission string) bool {
	permissions, ok := GetPermissions(c)
	if !ok {
		return false
	}
	for _, p := range permissions {
		if p == permission {
			return true
		}
	}
	return false
}
