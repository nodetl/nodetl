package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Permission represents a single permission in the system
type Permission string

// Define all available permissions
const (
	// Workflow permissions
	PermissionWorkflowView   Permission = "workflows:view"
	PermissionWorkflowCreate Permission = "workflows:create"
	PermissionWorkflowEdit   Permission = "workflows:edit"
	PermissionWorkflowDelete Permission = "workflows:delete"

	// Schema permissions
	PermissionSchemaView   Permission = "schemas:view"
	PermissionSchemaCreate Permission = "schemas:create"
	PermissionSchemaEdit   Permission = "schemas:edit"
	PermissionSchemaDelete Permission = "schemas:delete"

	// Execution permissions
	PermissionExecutionView   Permission = "executions:view"
	PermissionExecutionCreate Permission = "executions:create"
	PermissionExecutionEdit   Permission = "executions:edit"
	PermissionExecutionDelete Permission = "executions:delete"

	// Mapping permissions
	PermissionMappingView   Permission = "mappings:view"
	PermissionMappingCreate Permission = "mappings:create"
	PermissionMappingEdit   Permission = "mappings:edit"
	PermissionMappingDelete Permission = "mappings:delete"

	// Node Type permissions
	PermissionNodeTypeView   Permission = "node_types:view"
	PermissionNodeTypeCreate Permission = "node_types:create"
	PermissionNodeTypeEdit   Permission = "node_types:edit"
	PermissionNodeTypeDelete Permission = "node_types:delete"

	// Node Schema permissions
	PermissionNodeSchemaView   Permission = "node_schemas:view"
	PermissionNodeSchemaCreate Permission = "node_schemas:create"
	PermissionNodeSchemaEdit   Permission = "node_schemas:edit"
	PermissionNodeSchemaDelete Permission = "node_schemas:delete"

	// Version permissions
	PermissionVersionView   Permission = "versions:view"
	PermissionVersionCreate Permission = "versions:create"
	PermissionVersionEdit   Permission = "versions:edit"
	PermissionVersionDelete Permission = "versions:delete"

	// Project permissions
	PermissionProjectView   Permission = "projects:view"
	PermissionProjectCreate Permission = "projects:create"
	PermissionProjectEdit   Permission = "projects:edit"
	PermissionProjectDelete Permission = "projects:delete"

	// User management permissions
	PermissionUserView   Permission = "users:view"
	PermissionUserCreate Permission = "users:create"
	PermissionUserEdit   Permission = "users:edit"
	PermissionUserDelete Permission = "users:delete"

	// Role management permissions
	PermissionRoleView   Permission = "roles:view"
	PermissionRoleCreate Permission = "roles:create"
	PermissionRoleEdit   Permission = "roles:edit"
	PermissionRoleDelete Permission = "roles:delete"

	// Invitation permissions
	PermissionInvitationView   Permission = "invitations:view"
	PermissionInvitationCreate Permission = "invitations:create"
	PermissionInvitationEdit   Permission = "invitations:edit"
	PermissionInvitationDelete Permission = "invitations:delete"

	// Settings permissions
	PermissionSettingsView Permission = "settings:view"
	PermissionSettingsEdit Permission = "settings:edit"
)

// AllPermissions returns all available permissions
func AllPermissions() []Permission {
	return []Permission{
		PermissionWorkflowView, PermissionWorkflowCreate, PermissionWorkflowEdit, PermissionWorkflowDelete,
		PermissionSchemaView, PermissionSchemaCreate, PermissionSchemaEdit, PermissionSchemaDelete,
		PermissionExecutionView, PermissionExecutionCreate, PermissionExecutionEdit, PermissionExecutionDelete,
		PermissionMappingView, PermissionMappingCreate, PermissionMappingEdit, PermissionMappingDelete,
		PermissionNodeTypeView, PermissionNodeTypeCreate, PermissionNodeTypeEdit, PermissionNodeTypeDelete,
		PermissionNodeSchemaView, PermissionNodeSchemaCreate, PermissionNodeSchemaEdit, PermissionNodeSchemaDelete,
		PermissionVersionView, PermissionVersionCreate, PermissionVersionEdit, PermissionVersionDelete,
		PermissionProjectView, PermissionProjectCreate, PermissionProjectEdit, PermissionProjectDelete,
		PermissionUserView, PermissionUserCreate, PermissionUserEdit, PermissionUserDelete,
		PermissionRoleView, PermissionRoleCreate, PermissionRoleEdit, PermissionRoleDelete,
		PermissionInvitationView, PermissionInvitationCreate, PermissionInvitationEdit, PermissionInvitationDelete,
		PermissionSettingsView, PermissionSettingsEdit,
	}
}

// ViewPermissions returns all view permissions
func ViewPermissions() []Permission {
	return []Permission{
		PermissionWorkflowView, PermissionSchemaView, PermissionExecutionView,
		PermissionMappingView, PermissionNodeTypeView, PermissionNodeSchemaView,
		PermissionVersionView, PermissionProjectView,
	}
}

// EditorPermissions returns permissions for editor role
func EditorPermissions() []Permission {
	return []Permission{
		PermissionWorkflowView, PermissionWorkflowCreate, PermissionWorkflowEdit,
		PermissionSchemaView, PermissionSchemaCreate, PermissionSchemaEdit,
		PermissionExecutionView, PermissionExecutionCreate,
		PermissionMappingView, PermissionMappingCreate, PermissionMappingEdit,
		PermissionNodeTypeView, PermissionNodeTypeCreate, PermissionNodeTypeEdit,
		PermissionNodeSchemaView, PermissionNodeSchemaCreate, PermissionNodeSchemaEdit,
		PermissionVersionView, PermissionVersionCreate, PermissionVersionEdit,
		PermissionProjectView, PermissionProjectCreate, PermissionProjectEdit,
	}
}

// Role represents a role with a set of permissions
type Role struct {
	ID          primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name        string             `json:"name" bson:"name"`
	Description string             `json:"description" bson:"description"`
	Permissions []Permission       `json:"permissions" bson:"permissions"`
	IsSystem    bool               `json:"isSystem" bson:"is_system"` // System roles cannot be deleted
	CreatedAt   time.Time          `json:"createdAt" bson:"created_at"`
	UpdatedAt   time.Time          `json:"updatedAt" bson:"updated_at"`
}

// HasPermission checks if the role has a specific permission
func (r *Role) HasPermission(permission Permission) bool {
	for _, p := range r.Permissions {
		if p == permission {
			return true
		}
	}
	return false
}

// HasAnyPermission checks if the role has any of the specified permissions
func (r *Role) HasAnyPermission(permissions ...Permission) bool {
	for _, permission := range permissions {
		if r.HasPermission(permission) {
			return true
		}
	}
	return false
}

// DefaultRoles returns the default system roles
func DefaultRoles() []Role {
	now := time.Now()
	return []Role{
		{
			Name:        "Admin",
			Description: "Full access to all features",
			Permissions: AllPermissions(),
			IsSystem:    true,
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			Name:        "Editor",
			Description: "Can view and edit most features, but cannot manage users or roles",
			Permissions: EditorPermissions(),
			IsSystem:    true,
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			Name:        "Viewer",
			Description: "Read-only access to workflows and executions",
			Permissions: ViewPermissions(),
			IsSystem:    true,
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}
}

// CreateRoleRequest represents a request to create a role
type CreateRoleRequest struct {
	Name        string       `json:"name" binding:"required"`
	Description string       `json:"description"`
	Permissions []Permission `json:"permissions" binding:"required"`
}

// UpdateRoleRequest represents a request to update a role
type UpdateRoleRequest struct {
	Name        *string       `json:"name,omitempty"`
	Description *string       `json:"description,omitempty"`
	Permissions *[]Permission `json:"permissions,omitempty"`
}
