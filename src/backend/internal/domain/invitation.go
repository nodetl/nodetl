package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// InvitationStatus represents the status of an invitation
type InvitationStatus string

const (
	InvitationStatusPending  InvitationStatus = "pending"
	InvitationStatusAccepted InvitationStatus = "accepted"
	InvitationStatusExpired  InvitationStatus = "expired"
	InvitationStatusRevoked  InvitationStatus = "revoked"
)

// Invitation represents an invitation for a new user
type Invitation struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Email     string             `json:"email" bson:"email"`
	Name      string             `json:"name" bson:"name"`
	Token     string             `json:"-" bson:"token"` // Hashed token for security
	RoleID    primitive.ObjectID `json:"roleId" bson:"role_id"`
	Status    InvitationStatus   `json:"status" bson:"status"`
	ExpiresAt time.Time          `json:"expiresAt" bson:"expires_at"`
	CreatedAt time.Time          `json:"createdAt" bson:"created_at"`
	CreatedBy primitive.ObjectID `json:"createdBy" bson:"created_by"`
	AcceptedAt *time.Time        `json:"acceptedAt,omitempty" bson:"accepted_at,omitempty"`
}

// IsValid checks if the invitation is still valid
func (i *Invitation) IsValid() bool {
	return i.Status == InvitationStatusPending && time.Now().Before(i.ExpiresAt)
}

// CreateInvitationRequest represents a request to create an invitation
type CreateInvitationRequest struct {
	Email  string             `json:"email" binding:"required,email"`
	Name   string             `json:"name" binding:"required"`
	RoleID primitive.ObjectID `json:"roleId" binding:"required"`
}

// InvitationResponse represents an invitation in API responses
type InvitationResponse struct {
	ID        primitive.ObjectID `json:"id"`
	Email     string             `json:"email"`
	Name      string             `json:"name"`
	RoleID    primitive.ObjectID `json:"roleId"`
	RoleName  string             `json:"roleName,omitempty"`
	Status    InvitationStatus   `json:"status"`
	ExpiresAt time.Time          `json:"expiresAt"`
	CreatedAt time.Time          `json:"createdAt"`
	Link      string             `json:"link,omitempty"` // Invitation link for admin to share
}

// AcceptInvitationRequest represents a request to accept an invitation
type AcceptInvitationRequest struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
	Name     string `json:"name,omitempty"` // Optional, can override invitation name
}

// AcceptInvitationSSORequest represents a request to accept invitation via SSO
type AcceptInvitationSSORequest struct {
	Token    string `json:"token" binding:"required"`
	Provider string `json:"provider" binding:"required,oneof=google microsoft"`
}
