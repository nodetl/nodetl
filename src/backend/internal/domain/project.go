package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Project represents a project container with version tag and workflows
type Project struct {
	ID          primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name        string             `json:"name" bson:"name"`
	Description string             `json:"description,omitempty" bson:"description"`
	VersionTag  string             `json:"versionTag" bson:"version_tag"` // e.g., "1.0.0", "2.0.0"
	PathPrefix  string             `json:"pathPrefix" bson:"path_prefix"` // e.g., "/api/v1"
	Status      ProjectStatus      `json:"status" bson:"status"`
	IsLocked    bool               `json:"isLocked" bson:"is_locked"` // When true, no changes allowed
	Workflows   []Workflow         `json:"workflows" bson:"workflows"`
	CreatedAt   time.Time          `json:"createdAt" bson:"created_at"`
	UpdatedAt   time.Time          `json:"updatedAt" bson:"updated_at"`
	CreatedBy   string             `json:"createdBy" bson:"created_by"`
}

type ProjectStatus string

const (
	ProjectStatusDraft    ProjectStatus = "draft"
	ProjectStatusActive   ProjectStatus = "active"
	ProjectStatusInactive ProjectStatus = "inactive"
	ProjectStatusArchived ProjectStatus = "archived"
)

// ProjectListItem is a lighter version for list views
type ProjectListItem struct {
	ID            primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name          string             `json:"name" bson:"name"`
	Description   string             `json:"description,omitempty" bson:"description"`
	VersionTag    string             `json:"versionTag" bson:"version_tag"`
	PathPrefix    string             `json:"pathPrefix" bson:"path_prefix"`
	Status        ProjectStatus      `json:"status" bson:"status"`
	IsLocked      bool               `json:"isLocked" bson:"is_locked"`
	WorkflowCount int                `json:"workflowCount" bson:"workflow_count"`
	CreatedAt     time.Time          `json:"createdAt" bson:"created_at"`
	UpdatedAt     time.Time          `json:"updatedAt" bson:"updated_at"`
	CreatedBy     string             `json:"createdBy" bson:"created_by"`
}

// ProjectListResponse contains paginated project list
type ProjectListResponse struct {
	Data       []ProjectListItem `json:"data"`
	Total      int64             `json:"total"`
	Page       int               `json:"page"`
	PageSize   int               `json:"pageSize"`
	TotalPages int               `json:"totalPages"`
}
