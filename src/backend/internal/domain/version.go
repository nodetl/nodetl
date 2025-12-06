package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Version represents a version tag with its configuration
type Version struct {
	ID          primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Tag         string             `json:"tag" bson:"tag"`             // e.g., "1.0.0", "2.0.0"
	Name        string             `json:"name,omitempty" bson:"name"` // Display name
	Description string             `json:"description,omitempty" bson:"description"`
	PathPrefix  string             `json:"pathPrefix" bson:"path_prefix"`             // e.g., "/api/v1"
	Headers     map[string]string  `json:"headers,omitempty" bson:"headers"`          // Required headers
	QueryParams map[string]string  `json:"queryParams,omitempty" bson:"query_params"` // Default query params
	IsDefault   bool               `json:"isDefault" bson:"is_default"`               // Default version for new workflows
	CreatedAt   time.Time          `json:"createdAt" bson:"created_at"`
	UpdatedAt   time.Time          `json:"updatedAt" bson:"updated_at"`
}
