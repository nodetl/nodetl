package node

import (
	"context"
	"fmt"
	"time"

	"github.com/nodetl/nodetl/internal/domain"
)

// LoopNode iterates over arrays or conditions
type LoopNode struct{}

func (n *LoopNode) GetType() string {
	return domain.NodeTypeLoop
}

func (n *LoopNode) Validate(nodeData domain.NodeData) error {
	if nodeData.LoopType == "" {
		return fmt.Errorf("loop node requires a loop type")
	}
	return nil
}

func (n *LoopNode) Execute(ctx context.Context, execCtx *ExecutionContext, nodeData domain.NodeData) (*ExecutionResult, error) {
	input := execCtx.Input
	logs := []domain.LogEntry{}
	
	switch nodeData.LoopType {
	case "forEach":
		return n.executeForEach(ctx, input, nodeData, logs)
	case "while":
		return n.executeWhile(ctx, input, nodeData, logs)
	case "for":
		return n.executeFor(ctx, input, nodeData, logs)
	default:
		return nil, fmt.Errorf("unknown loop type: %s", nodeData.LoopType)
	}
}

func (n *LoopNode) executeForEach(ctx context.Context, input map[string]any, nodeData domain.NodeData, logs []domain.LogEntry) (*ExecutionResult, error) {
	arrayValue := getNestedValue(input, nodeData.LoopArrayPath)
	
	array, ok := arrayValue.([]any)
	if !ok {
		if arrayValue == nil {
			array = []any{}
		} else {
			return nil, fmt.Errorf("value at path %s is not an array", nodeData.LoopArrayPath)
		}
	}
	
	logs = append(logs, domain.LogEntry{
		Level:     "info",
		Message:   fmt.Sprintf("Starting forEach loop with %d items", len(array)),
		Timestamp: time.Now(),
	})
	
	// For now, we return the array items
	// In a full implementation, this would trigger sub-executions for each item
	return &ExecutionResult{
		Output: map[string]any{
			"items":    array,
			"count":    len(array),
			"original": input,
		},
		Logs:     logs,
		NextPort: "done",
	}, nil
}

func (n *LoopNode) executeWhile(ctx context.Context, input map[string]any, nodeData domain.NodeData, logs []domain.LogEntry) (*ExecutionResult, error) {
	logs = append(logs, domain.LogEntry{
		Level:     "info",
		Message:   "While loop execution",
		Timestamp: time.Now(),
	})
	
	return &ExecutionResult{
		Output:   input,
		Logs:     logs,
		NextPort: "done",
	}, nil
}

func (n *LoopNode) executeFor(ctx context.Context, input map[string]any, nodeData domain.NodeData, logs []domain.LogEntry) (*ExecutionResult, error) {
	logs = append(logs, domain.LogEntry{
		Level:     "info",
		Message:   "For loop execution",
		Timestamp: time.Now(),
	})
	
	return &ExecutionResult{
		Output:   input,
		Logs:     logs,
		NextPort: "done",
	}, nil
}
