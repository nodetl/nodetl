package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// NodeType represents a registered node type (built-in or custom)
type NodeType struct {
	ID          primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name        string             `json:"name" bson:"name"`
	Type        string             `json:"type" bson:"type"`               // unique identifier: trigger, transform, http, condition, loop, code, custom_*
	Category    string             `json:"category" bson:"category"`       // trigger, action, logic, transform, custom
	Description string             `json:"description" bson:"description"`
	Icon        string             `json:"icon" bson:"icon"`               // icon name or URL
	Color       string             `json:"color" bson:"color"`             // hex color for UI
	IsBuiltIn   bool               `json:"isBuiltIn" bson:"is_built_in"`
	Inputs      []PortDefinition   `json:"inputs" bson:"inputs"`
	Outputs     []PortDefinition   `json:"outputs" bson:"outputs"`
	ConfigSchema map[string]any    `json:"configSchema" bson:"config_schema"` // JSON Schema for node configuration
	CreatedAt   time.Time          `json:"createdAt" bson:"created_at"`
	UpdatedAt   time.Time          `json:"updatedAt" bson:"updated_at"`
}

type PortDefinition struct {
	Name        string `json:"name" bson:"name"`
	Type        string `json:"type" bson:"type"`               // data type: string, number, object, array, any
	Required    bool   `json:"required" bson:"required"`
	Description string `json:"description" bson:"description"`
}

// Built-in node type constants
const (
	NodeTypeTrigger   = "trigger"
	NodeTypeTransform = "transform"
	NodeTypeHTTP      = "http"
	NodeTypeCondition = "condition"
	NodeTypeLoop      = "loop"
	NodeTypeCode      = "code"
	NodeTypeDelay     = "delay"
	NodeTypeEmail     = "email"
	NodeTypeWebhook   = "webhook"
)

// Node categories
const (
	CategoryTrigger   = "trigger"
	CategoryAction    = "action"
	CategoryLogic     = "logic"
	CategoryTransform = "transform"
	CategoryCustom    = "custom"
)

// GetBuiltInNodeTypes returns all built-in node types
func GetBuiltInNodeTypes() []NodeType {
	return []NodeType{
		{
			Name:        "Trigger",
			Type:        NodeTypeTrigger,
			Category:    CategoryTrigger,
			Description: "Start point of the workflow. Can be triggered by webhook, schedule, or manually.",
			Icon:        "play",
			Color:       "#10B981",
			IsBuiltIn:   true,
			Inputs:      []PortDefinition{},
			Outputs: []PortDefinition{
				{Name: "output", Type: "any", Required: true, Description: "Trigger payload data"},
			},
			ConfigSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"triggerType": map[string]any{"type": "string", "enum": []string{"webhook", "schedule", "manual"}},
					"webhookPath": map[string]any{"type": "string"},
					"schedule":    map[string]any{"type": "string"},
				},
			},
		},
		{
			Name:        "Transform",
			Type:        NodeTypeTransform,
			Category:    CategoryTransform,
			Description: "Transform data from source schema to target schema with AI-powered field mapping.",
			Icon:        "shuffle",
			Color:       "#8B5CF6",
			IsBuiltIn:   true,
			Inputs: []PortDefinition{
				{Name: "input", Type: "object", Required: true, Description: "Input data to transform"},
			},
			Outputs: []PortDefinition{
				{Name: "output", Type: "object", Required: true, Description: "Transformed data"},
			},
			ConfigSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"sourceSchemaId": map[string]any{"type": "string"},
					"targetSchemaId": map[string]any{"type": "string"},
					"mappingRules":   map[string]any{"type": "array"},
				},
			},
		},
		{
			Name:        "HTTP Request",
			Type:        NodeTypeHTTP,
			Category:    CategoryAction,
			Description: "Make HTTP requests to external APIs.",
			Icon:        "globe",
			Color:       "#3B82F6",
			IsBuiltIn:   true,
			Inputs: []PortDefinition{
				{Name: "input", Type: "any", Required: false, Description: "Request body or parameters"},
			},
			Outputs: []PortDefinition{
				{Name: "response", Type: "object", Required: true, Description: "HTTP response"},
				{Name: "error", Type: "object", Required: false, Description: "Error if request fails"},
			},
			ConfigSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"method":  map[string]any{"type": "string", "enum": []string{"GET", "POST", "PUT", "DELETE", "PATCH"}},
					"url":     map[string]any{"type": "string"},
					"headers": map[string]any{"type": "object"},
					"body":    map[string]any{"type": "string"},
				},
			},
		},
		{
			Name:        "Condition",
			Type:        NodeTypeCondition,
			Category:    CategoryLogic,
			Description: "Branch workflow based on conditions.",
			Icon:        "git-branch",
			Color:       "#F59E0B",
			IsBuiltIn:   true,
			Inputs: []PortDefinition{
				{Name: "input", Type: "any", Required: true, Description: "Data to evaluate"},
			},
			Outputs: []PortDefinition{
				{Name: "true", Type: "any", Required: true, Description: "Output when condition is true"},
				{Name: "false", Type: "any", Required: true, Description: "Output when condition is false"},
			},
			ConfigSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"conditions": map[string]any{"type": "array"},
				},
			},
		},
		{
			Name:        "Loop",
			Type:        NodeTypeLoop,
			Category:    CategoryLogic,
			Description: "Iterate over arrays or repeat based on conditions.",
			Icon:        "repeat",
			Color:       "#EC4899",
			IsBuiltIn:   true,
			Inputs: []PortDefinition{
				{Name: "input", Type: "array", Required: true, Description: "Array to iterate"},
			},
			Outputs: []PortDefinition{
				{Name: "item", Type: "any", Required: true, Description: "Current item in iteration"},
				{Name: "done", Type: "array", Required: true, Description: "All results after loop completes"},
			},
			ConfigSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"loopType":      map[string]any{"type": "string", "enum": []string{"forEach", "while", "for"}},
					"loopArrayPath": map[string]any{"type": "string"},
					"loopCondition": map[string]any{"type": "string"},
				},
			},
		},
		{
			Name:        "Code",
			Type:        NodeTypeCode,
			Category:    CategoryLogic,
			Description: "Execute custom JavaScript code or expressions.",
			Icon:        "code",
			Color:       "#6366F1",
			IsBuiltIn:   true,
			Inputs: []PortDefinition{
				{Name: "input", Type: "any", Required: false, Description: "Input data for code execution"},
			},
			Outputs: []PortDefinition{
				{Name: "output", Type: "any", Required: true, Description: "Code execution result"},
			},
			ConfigSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"code": map[string]any{"type": "string"},
				},
			},
		},
		{
			Name:        "Delay",
			Type:        NodeTypeDelay,
			Category:    CategoryLogic,
			Description: "Wait for a specified duration before continuing.",
			Icon:        "clock",
			Color:       "#64748B",
			IsBuiltIn:   true,
			Inputs: []PortDefinition{
				{Name: "input", Type: "any", Required: true, Description: "Pass-through data"},
			},
			Outputs: []PortDefinition{
				{Name: "output", Type: "any", Required: true, Description: "Pass-through data after delay"},
			},
			ConfigSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"duration": map[string]any{"type": "number", "description": "Delay in milliseconds"},
				},
			},
		},
		{
			Name:        "Response",
			Type:        "response",
			Category:    CategoryAction,
			Description: "Send response back to the caller. Use after Transform to return the mapped data.",
			Icon:        "send",
			Color:       "#22C55E",
			IsBuiltIn:   true,
			Inputs: []PortDefinition{
				{Name: "input", Type: "any", Required: true, Description: "Data to send as response"},
			},
			Outputs: []PortDefinition{},
			ConfigSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"statusCode": map[string]any{"type": "number", "default": 200},
					"headers":    map[string]any{"type": "object"},
				},
			},
		},
	}
}
