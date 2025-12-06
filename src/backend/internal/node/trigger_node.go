package node

import (
	"context"
	"time"

	"github.com/nodetl/nodetl/internal/domain"
)

// TriggerNode is the entry point of a workflow
type TriggerNode struct{}

func (n *TriggerNode) GetType() string {
	return domain.NodeTypeTrigger
}

func (n *TriggerNode) Validate(nodeData domain.NodeData) error {
	return nil
}

func (n *TriggerNode) Execute(ctx context.Context, execCtx *ExecutionContext, nodeData domain.NodeData) (*ExecutionResult, error) {
	// Trigger node simply passes through the input data
	return &ExecutionResult{
		Output: execCtx.Input,
		Logs: []domain.LogEntry{
			{
				Level:     "info",
				Message:   "Workflow triggered",
				Timestamp: time.Now(),
				Data:      map[string]any{"triggerType": nodeData.TriggerType},
			},
		},
		NextPort: "output",
	}, nil
}
