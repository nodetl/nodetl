package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Execution represents a single workflow execution
type Execution struct {
	ID           primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	WorkflowID   primitive.ObjectID `json:"workflowId" bson:"workflow_id"`
	WorkflowName string             `json:"workflowName" bson:"workflow_name"`
	Status       ExecutionStatus    `json:"status" bson:"status"`
	TriggerType  string             `json:"triggerType" bson:"trigger_type"` // webhook, schedule, manual
	Input        map[string]any     `json:"input" bson:"input"`
	Output       map[string]any     `json:"output,omitempty" bson:"output,omitempty"`
	Error        *ExecutionError    `json:"error,omitempty" bson:"error,omitempty"`
	NodeLogs     []NodeExecutionLog `json:"nodeLogs" bson:"node_logs"`
	StartedAt    time.Time          `json:"startedAt" bson:"started_at"`
	CompletedAt  *time.Time         `json:"completedAt,omitempty" bson:"completed_at,omitempty"`
	Duration     int64              `json:"duration" bson:"duration"` // milliseconds
	Metadata     map[string]any     `json:"metadata,omitempty" bson:"metadata,omitempty"`
}

type ExecutionStatus string

const (
	ExecutionStatusPending   ExecutionStatus = "pending"
	ExecutionStatusRunning   ExecutionStatus = "running"
	ExecutionStatusCompleted ExecutionStatus = "completed"
	ExecutionStatusFailed    ExecutionStatus = "failed"
	ExecutionStatusCancelled ExecutionStatus = "cancelled"
)

type ExecutionError struct {
	NodeID  string `json:"nodeId" bson:"node_id"`
	Message string `json:"message" bson:"message"`
	Code    string `json:"code,omitempty" bson:"code,omitempty"`
	Stack   string `json:"stack,omitempty" bson:"stack,omitempty"`
}

// NodeExecutionLog represents the execution trace of a single node
type NodeExecutionLog struct {
	NodeID      string         `json:"nodeId" bson:"node_id"`
	NodeType    string         `json:"nodeType" bson:"node_type"`
	NodeLabel   string         `json:"nodeLabel" bson:"node_label"`
	Status      ExecutionStatus `json:"status" bson:"status"`
	Input       map[string]any `json:"input" bson:"input"`
	Output      map[string]any `json:"output,omitempty" bson:"output,omitempty"`
	Error       *string        `json:"error,omitempty" bson:"error,omitempty"`
	StartedAt   time.Time      `json:"startedAt" bson:"started_at"`
	CompletedAt *time.Time     `json:"completedAt,omitempty" bson:"completed_at,omitempty"`
	Duration    int64          `json:"duration" bson:"duration"` // milliseconds
	Logs        []LogEntry     `json:"logs,omitempty" bson:"logs,omitempty"`
}

type LogEntry struct {
	Level     string    `json:"level" bson:"level"` // debug, info, warn, error
	Message   string    `json:"message" bson:"message"`
	Timestamp time.Time `json:"timestamp" bson:"timestamp"`
	Data      any       `json:"data,omitempty" bson:"data,omitempty"`
}
