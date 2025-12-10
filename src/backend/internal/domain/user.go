package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// UserStatus represents the status of a user account
type UserStatus string

const (
	UserStatusInvited  UserStatus = "invited"  // User has been invited but hasn't accepted yet
	UserStatusActive   UserStatus = "active"   // User account is active
	UserStatusInactive UserStatus = "inactive" // User account is deactivated
)

// ThemePreference represents the user's theme preference
type ThemePreference string

const (
	ThemeLight  ThemePreference = "light"
	ThemeDark   ThemePreference = "dark"
	ThemeSystem ThemePreference = "system"
)

// User represents a user in the system
type User struct {
	ID              primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Email           string             `json:"email" bson:"email"`
	PasswordHash    string             `json:"-" bson:"password_hash,omitempty"`
	Name            string             `json:"name" bson:"name"`
	FirstName       string             `json:"firstName" bson:"first_name"`
	LastName        string             `json:"lastName" bson:"last_name"`
	Avatar          string             `json:"avatar,omitempty" bson:"avatar,omitempty"`
	Status          UserStatus         `json:"status" bson:"status"`
	IsActive        bool               `json:"isActive" bson:"-"` // Computed from Status, not stored in DB
	RoleID          primitive.ObjectID `json:"roleId" bson:"role_id"`
	ThemePreference ThemePreference    `json:"themePreference" bson:"theme_preference"`

	// SSO Provider IDs
	GoogleID    string `json:"googleId,omitempty" bson:"google_id,omitempty"`
	MicrosoftID string `json:"microsoftId,omitempty" bson:"microsoft_id,omitempty"`

	// Password management
	MustChangePassword bool       `json:"mustChangePassword" bson:"must_change_password"`
	LastPasswordChange *time.Time `json:"lastPasswordChange,omitempty" bson:"last_password_change,omitempty"`

	// Audit fields
	LastLoginAt *time.Time `json:"lastLoginAt,omitempty" bson:"last_login_at,omitempty"`
	CreatedAt   time.Time  `json:"createdAt" bson:"created_at"`
	UpdatedAt   time.Time  `json:"updatedAt" bson:"updated_at"`
	CreatedBy   string     `json:"createdBy,omitempty" bson:"created_by,omitempty"`
}

// ComputeIsActive sets the IsActive field based on Status
func (u *User) ComputeIsActive() {
	u.IsActive = u.Status == UserStatusActive
}

// UserWithRole includes the user with their role details
type UserWithRole struct {
	User
	Role *Role `json:"role,omitempty" bson:"role,omitempty"`
}

// PublicUser is a sanitized version of User for API responses
type PublicUser struct {
	ID                 primitive.ObjectID `json:"id"`
	Email              string             `json:"email"`
	Name               string             `json:"name"`
	FirstName          string             `json:"firstName"`
	LastName           string             `json:"lastName"`
	Avatar             string             `json:"avatar,omitempty"`
	Status             UserStatus         `json:"status"`
	IsActive           bool               `json:"isActive"`
	RoleID             primitive.ObjectID `json:"roleId"`
	ThemePreference    ThemePreference    `json:"themePreference"`
	MustChangePassword bool               `json:"mustChangePassword"`
	Permissions        []string           `json:"permissions,omitempty"`
	LastLoginAt        *time.Time         `json:"lastLoginAt,omitempty"`
	CreatedAt          time.Time          `json:"createdAt"`
}

// ToPublic converts a User to PublicUser
func (u *User) ToPublic() PublicUser {
	return PublicUser{
		ID:                 u.ID,
		Email:              u.Email,
		Name:               u.Name,
		FirstName:          u.FirstName,
		LastName:           u.LastName,
		Avatar:             u.Avatar,
		Status:             u.Status,
		IsActive:           u.Status == UserStatusActive,
		RoleID:             u.RoleID,
		ThemePreference:    u.ThemePreference,
		MustChangePassword: u.MustChangePassword,
		LastLoginAt:        u.LastLoginAt,
		CreatedAt:          u.CreatedAt,
	}
}

// CreateUserRequest represents a request to create a user (admin only)
type CreateUserRequest struct {
	Email  string             `json:"email" binding:"required,email"`
	Name   string             `json:"name" binding:"required"`
	RoleID primitive.ObjectID `json:"roleId" binding:"required"`
}

// UpdateUserRequest represents a request to update a user
type UpdateUserRequest struct {
	Name            *string             `json:"name,omitempty"`
	FirstName       *string             `json:"firstName,omitempty"`
	LastName        *string             `json:"lastName,omitempty"`
	Avatar          *string             `json:"avatar,omitempty"`
	RoleID          *primitive.ObjectID `json:"roleId,omitempty"`
	Status          *UserStatus         `json:"status,omitempty"`
	ThemePreference *ThemePreference    `json:"themePreference,omitempty"`
}

// UpdatePreferencesRequest represents a request to update user preferences
type UpdatePreferencesRequest struct {
	ThemePreference *ThemePreference `json:"themePreference,omitempty"`
}

// ChangePasswordRequest represents a request to change password
type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword" binding:"required"`
	NewPassword     string `json:"newPassword" binding:"required,min=8"`
}

// SetPasswordRequest represents a request to set password (for invited users)
type SetPasswordRequest struct {
	Password string `json:"password" binding:"required,min=8"`
}
