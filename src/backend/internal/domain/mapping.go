package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// FieldMapping represents an AI-generated or user-defined field mapping
type FieldMapping struct {
	ID              primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name            string             `json:"name" bson:"name"`
	Description     string             `json:"description" bson:"description"`
	SourceSchemaID  primitive.ObjectID `json:"sourceSchemaId" bson:"source_schema_id"`
	TargetSchemaID  primitive.ObjectID `json:"targetSchemaId" bson:"target_schema_id"`
	Rules           []MappingRule      `json:"rules" bson:"rules"`
	AIGenerated     bool               `json:"aiGenerated" bson:"ai_generated"`
	Confidence      float64            `json:"confidence" bson:"confidence"` // AI confidence score 0-1
	CreatedAt       time.Time          `json:"createdAt" bson:"created_at"`
	UpdatedAt       time.Time          `json:"updatedAt" bson:"updated_at"`
	CreatedBy       string             `json:"createdBy" bson:"created_by"`
}

// AIMappingRequest is the request structure for AI field mapping
type AIMappingRequest struct {
	SourceSchema    Schema         `json:"sourceSchema"`
	TargetSchema    Schema         `json:"targetSchema"`
	SampleData      map[string]any `json:"sampleData,omitempty"`
	ExistingRules   []MappingRule  `json:"existingRules,omitempty"`
	Instructions    string         `json:"instructions,omitempty"` // Additional context for AI
}

// AIMappingResponse is the response from AI field mapping
type AIMappingResponse struct {
	Rules       []MappingRule `json:"rules"`
	Confidence  float64       `json:"confidence"`
	Explanation string        `json:"explanation"`
	Suggestions []string      `json:"suggestions,omitempty"` // Additional suggestions for user
}

// TransformOperator defines available transform operations
type TransformOperator string

const (
	TransformOpDirect      TransformOperator = "direct"       // Direct copy
	TransformOpConcat      TransformOperator = "concat"       // Concatenate strings
	TransformOpSplit       TransformOperator = "split"        // Split string
	TransformOpFormat      TransformOperator = "format"       // Format string
	TransformOpParseDate   TransformOperator = "parseDate"    // Parse date
	TransformOpFormatDate  TransformOperator = "formatDate"   // Format date
	TransformOpToNumber    TransformOperator = "toNumber"     // Convert to number
	TransformOpToString    TransformOperator = "toString"     // Convert to string
	TransformOpToBoolean   TransformOperator = "toBoolean"    // Convert to boolean
	TransformOpLowercase   TransformOperator = "lowercase"    // To lowercase
	TransformOpUppercase   TransformOperator = "uppercase"    // To uppercase
	TransformOpTrim        TransformOperator = "trim"         // Trim whitespace
	TransformOpReplace     TransformOperator = "replace"      // Replace substring
	TransformOpExtract     TransformOperator = "extract"      // Extract with regex
	TransformOpLookup      TransformOperator = "lookup"       // Lookup table
	TransformOpExpression  TransformOperator = "expression"   // Custom expression
	TransformOpDefault     TransformOperator = "default"      // Use default value
	TransformOpCondition   TransformOperator = "condition"    // Conditional mapping
)
