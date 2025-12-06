package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// RefreshToken represents a refresh token stored in the database
type RefreshToken struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Token     string             `json:"-" bson:"token"` // Hashed token
	UserID    primitive.ObjectID `json:"userId" bson:"user_id"`
	UserAgent string             `json:"userAgent,omitempty" bson:"user_agent,omitempty"`
	IPAddress string             `json:"ipAddress,omitempty" bson:"ip_address,omitempty"`
	ExpiresAt time.Time          `json:"expiresAt" bson:"expires_at"`
	CreatedAt time.Time          `json:"createdAt" bson:"created_at"`
	RevokedAt *time.Time         `json:"revokedAt,omitempty" bson:"revoked_at,omitempty"`
}

// IsValid checks if the token is still valid
func (rt *RefreshToken) IsValid() bool {
	return rt.RevokedAt == nil && time.Now().Before(rt.ExpiresAt)
}

// TokenPair represents an access token and refresh token pair
type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int64  `json:"expiresIn"` // Access token expiry in seconds
}

// LoginRequest represents a login request
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse represents a login response
type LoginResponse struct {
	User   PublicUser `json:"user"`
	Tokens TokenPair  `json:"tokens"`
}

// RefreshTokenRequest represents a refresh token request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

// RefreshTokenResponse represents a refresh token response
type RefreshTokenResponse struct {
	Tokens TokenPair `json:"tokens"`
}

// OAuthCallbackParams represents OAuth callback parameters
type OAuthCallbackParams struct {
	Code  string `form:"code" binding:"required"`
	State string `form:"state"`
}

// OAuthUserInfo represents user info from OAuth provider
type OAuthUserInfo struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Picture   string `json:"picture,omitempty"`
	Provider  string `json:"provider"` // "google" or "microsoft"
}
