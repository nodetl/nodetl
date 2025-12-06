package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Workflow represents a complete workflow definition
type Workflow struct {
	ID          primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	ProjectID   string             `json:"projectId,omitempty" bson:"project_id,omitempty"` // Reference to parent project
	Name        string             `json:"name" bson:"name"`
	Description string             `json:"description" bson:"description"`
	Version     int                `json:"version" bson:"version"`
	VersionTag  string             `json:"versionTag,omitempty" bson:"version_tag,omitempty"` // Semantic version like "1.0.0"
	Status      WorkflowStatus     `json:"status" bson:"status"`
	Nodes       []Node             `json:"nodes" bson:"nodes"`
	Edges       []Edge             `json:"edges" bson:"edges"`
	Endpoint    *EndpointConfig    `json:"endpoint,omitempty" bson:"endpoint,omitempty"`
	Settings    *WorkflowSettings  `json:"settings,omitempty" bson:"settings,omitempty"`
	Variables   map[string]any     `json:"variables,omitempty" bson:"variables,omitempty"`
	CreatedAt   time.Time          `json:"createdAt" bson:"created_at"`
	UpdatedAt   time.Time          `json:"updatedAt" bson:"updated_at"`
	CreatedBy   string             `json:"createdBy" bson:"created_by"`
}

// WorkflowSettings contains workflow-level settings
type WorkflowSettings struct {
	AutoSave        bool              `json:"autoSave" bson:"auto_save"`
	AutoSaveEnabled bool              `json:"autoSaveEnabled" bson:"auto_save_enabled"`
	WebhookPath     string            `json:"webhookPath,omitempty" bson:"webhook_path,omitempty"`
	CustomHeaders   map[string]string `json:"customHeaders,omitempty" bson:"custom_headers,omitempty"`
}

type WorkflowStatus string

const (
	WorkflowStatusDraft    WorkflowStatus = "draft"
	WorkflowStatusActive   WorkflowStatus = "active"
	WorkflowStatusInactive WorkflowStatus = "inactive"
	WorkflowStatusArchived WorkflowStatus = "archived"
)

// Node represents a single node in the workflow
type Node struct {
	ID       string     `json:"id" bson:"id"`
	Type     string     `json:"type" bson:"type"`
	Label    string     `json:"label" bson:"label"`
	Position Position   `json:"position" bson:"position"`
	Data     NodeData   `json:"data" bson:"data"`
	Inputs   []NodePort `json:"inputs,omitempty" bson:"inputs,omitempty"`
	Outputs  []NodePort `json:"outputs,omitempty" bson:"outputs,omitempty"`
}

type Position struct {
	X float64 `json:"x" bson:"x"`
	Y float64 `json:"y" bson:"y"`
}

type NodePort struct {
	ID   string `json:"id" bson:"id"`
	Name string `json:"name" bson:"name"`
	Type string `json:"type" bson:"type"` // data type: string, number, object, array, any
}

// NodeData contains type-specific configuration for each node
type NodeData struct {
	// Common fields
	Description string `json:"description,omitempty" bson:"description,omitempty"`

	// Trigger node specific
	TriggerType   string `json:"triggerType,omitempty" bson:"trigger_type,omitempty"` // webhook, schedule, manual
	WebhookPath   string `json:"webhookPath,omitempty" bson:"webhook_path,omitempty"`
	WebhookMethod string `json:"webhookMethod,omitempty" bson:"webhook_method,omitempty"` // GET, POST, PUT, DELETE
	Schedule      string `json:"schedule,omitempty" bson:"schedule,omitempty"`            // cron expression

	// Transform node specific
	SourceSchemaID string        `json:"sourceSchemaId,omitempty" bson:"source_schema_id,omitempty"`
	TargetSchemaID string        `json:"targetSchemaId,omitempty" bson:"target_schema_id,omitempty"`
	MappingRules   []MappingRule `json:"mappingRules,omitempty" bson:"mapping_rules,omitempty"`

	// HTTP node specific
	HTTPMethod  string            `json:"httpMethod,omitempty" bson:"http_method,omitempty"`
	HTTPURL     string            `json:"httpUrl,omitempty" bson:"http_url,omitempty"`
	HTTPHeaders map[string]string `json:"httpHeaders,omitempty" bson:"http_headers,omitempty"`
	HTTPBody    string            `json:"httpBody,omitempty" bson:"http_body,omitempty"`

	// Condition node specific
	Conditions []Condition `json:"conditions,omitempty" bson:"conditions,omitempty"`

	// Loop node specific
	LoopType      string `json:"loopType,omitempty" bson:"loop_type,omitempty"` // forEach, while, for
	LoopArrayPath string `json:"loopArrayPath,omitempty" bson:"loop_array_path,omitempty"`
	LoopCondition string `json:"loopCondition,omitempty" bson:"loop_condition,omitempty"`

	// Code node specific (custom JavaScript/expression)
	Code string `json:"code,omitempty" bson:"code,omitempty"`

	// Response node specific
	ResponseConfig *ResponseConfig `json:"responseConfig,omitempty" bson:"response_config,omitempty"`

	// Custom node specific
	CustomConfig map[string]any `json:"customConfig,omitempty" bson:"custom_config,omitempty"`
}

// ResponseConfig contains configuration for response node
type ResponseConfig struct {
	StatusCode       int               `json:"statusCode" bson:"status_code"`
	Headers          map[string]string `json:"headers,omitempty" bson:"headers,omitempty"`
	SelectedFields   []ResponseField   `json:"selectedFields,omitempty" bson:"selected_fields,omitempty"`     // Fields to include in response
	UseTemplate      bool              `json:"useTemplate,omitempty" bson:"use_template,omitempty"`           // Use custom JSON template
	ResponseTemplate string            `json:"responseTemplate,omitempty" bson:"response_template,omitempty"` // JSON template with {{field}} placeholders
	ErrorConfig      *ErrorConfig      `json:"errorConfig,omitempty" bson:"error_config,omitempty"`           // Error handling configuration
}

// ErrorConfig contains error handling configuration
type ErrorConfig struct {
	IncludeTraceID     bool              `json:"includeTraceId" bson:"include_trace_id"`                            // Include trace ID in error response
	UseCustomTemplate  bool              `json:"useCustomTemplate" bson:"use_custom_template"`                      // Use custom error template
	ErrorTemplate      string            `json:"errorTemplate,omitempty" bson:"error_template,omitempty"`           // Custom error template
	ErrorStatusCode    int               `json:"errorStatusCode,omitempty" bson:"error_status_code,omitempty"`      // Default error status code (default 500)
	ValidationErrors   *ValidationConfig `json:"validationErrors,omitempty" bson:"validation_errors,omitempty"`     // 400 Bad Request config
	NotFoundErrors     *ValidationConfig `json:"notFoundErrors,omitempty" bson:"not_found_errors,omitempty"`        // 404 Not Found config
	UnauthorizedErrors *ValidationConfig `json:"unauthorizedErrors,omitempty" bson:"unauthorized_errors,omitempty"` // 401 Unauthorized config
	ForbiddenErrors    *ValidationConfig `json:"forbiddenErrors,omitempty" bson:"forbidden_errors,omitempty"`       // 403 Forbidden config
}

// ValidationConfig contains configuration for specific error types
type ValidationConfig struct {
	Enabled    bool   `json:"enabled" bson:"enabled"`
	StatusCode int    `json:"statusCode" bson:"status_code"`
	Template   string `json:"template,omitempty" bson:"template,omitempty"` // Custom template for this error type
}

// ResponseField represents a field selected for response
type ResponseField struct {
	ID           string `json:"id" bson:"id"`
	FieldPath    string `json:"fieldPath" bson:"field_path"`                            // Path to field (e.g., "email", "data.user")
	Source       string `json:"source" bson:"source"`                                   // "transform" or "http"
	SourceNodeId string `json:"sourceNodeId,omitempty" bson:"source_node_id,omitempty"` // ID of the source node
	Alias        string `json:"alias,omitempty" bson:"alias,omitempty"`                 // Optional: rename field in response
}

type MappingRule struct {
	ID           string `json:"id" bson:"id"`
	SourceField  string `json:"sourceField" bson:"source_field"`
	TargetField  string `json:"targetField" bson:"target_field"`
	Transform    string `json:"transform,omitempty" bson:"transform,omitempty"` // expression for transformation
	DefaultValue any    `json:"defaultValue,omitempty" bson:"default_value,omitempty"`
}

type Condition struct {
	ID       string `json:"id" bson:"id"`
	Field    string `json:"field" bson:"field"`
	Operator string `json:"operator" bson:"operator"` // eq, neq, gt, gte, lt, lte, contains, regex
	Value    any    `json:"value" bson:"value"`
	OutputID string `json:"outputId" bson:"output_id"` // which output port to use if condition matches
}

// Edge represents a connection between two nodes
type Edge struct {
	ID           string `json:"id" bson:"id"`
	Source       string `json:"source" bson:"source"`                                  // source node ID
	Target       string `json:"target" bson:"target"`                                  // target node ID
	SourceHandle string `json:"sourceHandle,omitempty" bson:"source_handle,omitempty"` // source port ID
	TargetHandle string `json:"targetHandle,omitempty" bson:"target_handle,omitempty"` // target port ID
	Label        string `json:"label,omitempty" bson:"label,omitempty"`
}

// EndpointConfig for auto-generated webhook endpoints
type EndpointConfig struct {
	Path       string            `json:"path" bson:"path"`
	Method     string            `json:"method" bson:"method"`      // GET, POST, PUT, DELETE
	AuthType   string            `json:"authType" bson:"auth_type"` // none, apiKey, jwt
	APIKey     string            `json:"apiKey,omitempty" bson:"api_key,omitempty"`
	Headers    map[string]string `json:"headers,omitempty" bson:"headers,omitempty"`      // Custom headers to require
	RateLimit  int               `json:"rateLimit,omitempty" bson:"rate_limit,omitempty"` // requests per minute
	AllowedIPs []string          `json:"allowedIPs,omitempty" bson:"allowed_ips,omitempty"`
}
