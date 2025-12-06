package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// NodeSchema represents imported schemas for a specific transform node
type NodeSchema struct {
	ID           primitive.ObjectID  `json:"id" bson:"_id,omitempty"`
	WorkflowID   string              `json:"workflowId" bson:"workflow_id"`
	NodeID       string              `json:"nodeId" bson:"node_id"`
	SourceSchema *ImportedSchema     `json:"sourceSchema,omitempty" bson:"source_schema,omitempty"`
	TargetSchema *ImportedSchema     `json:"targetSchema,omitempty" bson:"target_schema,omitempty"`
	Connections  []MappingConnection `json:"connections,omitempty" bson:"connections,omitempty"`
	HeaderFields []HeaderField       `json:"headerFields,omitempty" bson:"header_fields,omitempty"`
	CreatedAt    time.Time           `json:"createdAt" bson:"created_at"`
	UpdatedAt    time.Time           `json:"updatedAt" bson:"updated_at"`
}

// ImportedSchema represents a schema imported from JSON
type ImportedSchema struct {
	ID     string        `json:"id" bson:"id"`
	Name   string        `json:"name" bson:"name"`
	Fields []SchemaField `json:"fields" bson:"fields"`
}

// MappingConnection represents a field mapping connection
type MappingConnection struct {
	ID            string                 `json:"id" bson:"id"`
	SourceField   string                 `json:"sourceField" bson:"source_field"`
	TargetField   string                 `json:"targetField" bson:"target_field"`
	Formula       string                 `json:"formula" bson:"formula"`
	TransformType string                 `json:"transformType" bson:"transform_type"`
	Color         string                 `json:"color" bson:"color"`
	SourceType    string                 `json:"sourceType,omitempty" bson:"source_type,omitempty"`
	Config        map[string]interface{} `json:"config,omitempty" bson:"config,omitempty"`
	Validation    []ValidationRule       `json:"validation,omitempty" bson:"validation,omitempty"`
}

// ValidationRule represents a validation rule for a mapping
type ValidationRule struct {
	ID      string      `json:"id" bson:"id"`
	Type    string      `json:"type" bson:"type"`
	Value   interface{} `json:"value,omitempty" bson:"value,omitempty"`
	Message string      `json:"message" bson:"message"`
	Enabled bool        `json:"enabled" bson:"enabled"`
}

// HeaderField represents a header field for mapping
type HeaderField struct {
	ID    string `json:"id" bson:"id"`
	Name  string `json:"name" bson:"name"`
	Value string `json:"value" bson:"value"`
	Type  string `json:"type" bson:"type"`
	Path  string `json:"path" bson:"path"`
}
