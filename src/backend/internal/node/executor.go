package node

import (
	"context"

	"github.com/nodetl/nodetl/internal/domain"
)

// ExecutionContext contains all data available during node execution
type ExecutionContext struct {
	WorkflowID      string
	ExecutionID     string
	NodeID          string
	TraceID         string         // Unique trace ID for request tracking
	Input           map[string]any // Current input (output from previous node)
	TriggerInput    map[string]any // Original input from trigger (webhook request)
	PreviousInput   map[string]any // Input of previous node (before it processed)
	Variables       map[string]any // Workflow-level variables
	PreviousData    map[string]any // Data from previous nodes
	Metadata        map[string]any
	Error           *ExecutionError // Error from previous nodes
}

// ExecutionError represents an error during execution
type ExecutionError struct {
	Type       string `json:"type"`       // validation, not_found, unauthorized, forbidden, internal
	Message    string `json:"message"`
	StatusCode int    `json:"statusCode"`
	Details    any    `json:"details,omitempty"`
}

// ExecutionResult is the result of a node execution
type ExecutionResult struct {
	Output   map[string]any
	Error    error
	Logs     []domain.LogEntry
	NextPort string // Which output port to use for next node
}

// NodeExecutor is the interface that all node types must implement
type NodeExecutor interface {
	// Execute runs the node logic
	Execute(ctx context.Context, execCtx *ExecutionContext, nodeData domain.NodeData) (*ExecutionResult, error)
	
	// Validate validates node configuration before execution
	Validate(nodeData domain.NodeData) error
	
	// GetType returns the node type identifier
	GetType() string
}

// Registry manages all registered node executors
type Registry struct {
	executors map[string]NodeExecutor
}

var globalRegistry *Registry

// GetRegistry returns the global node registry
func GetRegistry() *Registry {
	if globalRegistry == nil {
		globalRegistry = &Registry{
			executors: make(map[string]NodeExecutor),
		}
		// Register built-in nodes
		globalRegistry.registerBuiltIn()
	}
	return globalRegistry
}

// Register adds a new node executor to the registry
func (r *Registry) Register(executor NodeExecutor) {
	r.executors[executor.GetType()] = executor
}

// Get returns a node executor by type
func (r *Registry) Get(nodeType string) (NodeExecutor, bool) {
	executor, ok := r.executors[nodeType]
	return executor, ok
}

// GetAll returns all registered executors
func (r *Registry) GetAll() map[string]NodeExecutor {
	return r.executors
}

// registerBuiltIn registers all built-in node executors
func (r *Registry) registerBuiltIn() {
	r.Register(&TriggerNode{})
	r.Register(&TransformNode{})
	r.Register(&HTTPNode{})
	r.Register(&ConditionNode{})
	r.Register(&LoopNode{})
	r.Register(&CodeNode{})
	r.Register(&DelayNode{})
}
