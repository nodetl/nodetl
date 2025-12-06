package node

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nodetl/nodetl/internal/domain"
)

// CodeNode executes custom code/expressions
type CodeNode struct{}

func (n *CodeNode) GetType() string {
	return domain.NodeTypeCode
}

func (n *CodeNode) Validate(nodeData domain.NodeData) error {
	if nodeData.Code == "" {
		return fmt.Errorf("code node requires code to execute")
	}
	return nil
}

func (n *CodeNode) Execute(ctx context.Context, execCtx *ExecutionContext, nodeData domain.NodeData) (*ExecutionResult, error) {
	logs := []domain.LogEntry{}
	
	logs = append(logs, domain.LogEntry{
		Level:     "info",
		Message:   "Executing code node",
		Timestamp: time.Now(),
	})
	
	// For safety, we use a simple expression evaluator instead of full JS execution
	// In production, you might want to use a sandboxed JS runtime like otto or goja
	output, err := evaluateExpression(nodeData.Code, execCtx.Input)
	if err != nil {
		logs = append(logs, domain.LogEntry{
			Level:     "error",
			Message:   fmt.Sprintf("Code execution failed: %v", err),
			Timestamp: time.Now(),
		})
		return &ExecutionResult{
			Error: err,
			Logs:  logs,
			Output: map[string]any{
				"error": err.Error(),
				"input": execCtx.Input,
			},
		}, nil
	}
	
	return &ExecutionResult{
		Output: map[string]any{
			"result": output,
			"input":  execCtx.Input,
		},
		Logs:     logs,
		NextPort: "output",
	}, nil
}

// evaluateExpression is a simple expression evaluator
// Supports basic JSON transformations and field access
func evaluateExpression(code string, input map[string]any) (any, error) {
	// If code is a JSON template, try to parse it
	if len(code) > 0 && (code[0] == '{' || code[0] == '[') {
		var result any
		// Replace variables in the template
		processed := replaceVariables(code, input)
		if err := json.Unmarshal([]byte(processed), &result); err != nil {
			return nil, fmt.Errorf("invalid JSON expression: %v", err)
		}
		return result, nil
	}
	
	// If code is a field path, return the value
	if value := getNestedValue(input, code); value != nil {
		return value, nil
	}
	
	// Otherwise, return the input with code as a marker
	return map[string]any{
		"expression": code,
		"data":       input,
	}, nil
}

// DelayNode pauses execution for a specified duration
type DelayNode struct{}

func (n *DelayNode) GetType() string {
	return domain.NodeTypeDelay
}

func (n *DelayNode) Validate(nodeData domain.NodeData) error {
	return nil
}

func (n *DelayNode) Execute(ctx context.Context, execCtx *ExecutionContext, nodeData domain.NodeData) (*ExecutionResult, error) {
	logs := []domain.LogEntry{}
	
	// Get duration from custom config
	duration := time.Duration(0)
	if nodeData.CustomConfig != nil {
		if d, ok := nodeData.CustomConfig["duration"].(float64); ok {
			duration = time.Duration(d) * time.Millisecond
		}
	}
	
	if duration > 0 {
		logs = append(logs, domain.LogEntry{
			Level:     "info",
			Message:   fmt.Sprintf("Waiting for %v", duration),
			Timestamp: time.Now(),
		})
		
		select {
		case <-time.After(duration):
		case <-ctx.Done():
			return &ExecutionResult{
				Error: ctx.Err(),
				Logs:  logs,
			}, ctx.Err()
		}
	}
	
	return &ExecutionResult{
		Output:   execCtx.Input,
		Logs:     logs,
		NextPort: "output",
	}, nil
}
