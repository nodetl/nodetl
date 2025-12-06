package executor

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/node"
	"github.com/nodetl/nodetl/internal/repository"
	"github.com/nodetl/nodetl/pkg/logger"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// FlowExecutor executes workflows
type FlowExecutor struct {
	workflowRepo   repository.WorkflowRepository
	executionRepo  repository.ExecutionRepository
	nodeSchemaRepo repository.NodeSchemaRepository
	nodeRegistry   *node.Registry
}

// NewFlowExecutor creates a new flow executor
func NewFlowExecutor(
	workflowRepo repository.WorkflowRepository,
	executionRepo repository.ExecutionRepository,
	nodeSchemaRepo repository.NodeSchemaRepository,
) *FlowExecutor {
	return &FlowExecutor{
		workflowRepo:   workflowRepo,
		executionRepo:  executionRepo,
		nodeSchemaRepo: nodeSchemaRepo,
		nodeRegistry:   node.GetRegistry(),
	}
}

// ExecuteRequest contains the request to execute a workflow
type ExecuteRequest struct {
	WorkflowID  primitive.ObjectID
	TriggerType string
	TriggerPath string // Optional: specific trigger path for multi-trigger workflows
	Input       map[string]any
	Metadata    map[string]any
}

// ExecuteResult contains the result of workflow execution
type ExecuteResult struct {
	ExecutionID string
	Status      domain.ExecutionStatus
	Output      map[string]any
	Error       *domain.ExecutionError
	Duration    int64
}

// Execute runs a workflow
func (e *FlowExecutor) Execute(ctx context.Context, req *ExecuteRequest) (*ExecuteResult, error) {
	startTime := time.Now()

	// Get workflow
	workflow, err := e.workflowRepo.GetByID(ctx, req.WorkflowID)
	if err != nil {
		return nil, fmt.Errorf("failed to get workflow: %w", err)
	}
	if workflow == nil {
		return nil, fmt.Errorf("workflow not found")
	}

	// Create execution record
	execution := &domain.Execution{
		WorkflowID:   workflow.ID,
		WorkflowName: workflow.Name,
		Status:       domain.ExecutionStatusRunning,
		TriggerType:  req.TriggerType,
		Input:        req.Input,
		NodeLogs:     []domain.NodeExecutionLog{},
		Metadata:     req.Metadata,
	}

	// Generate TraceID for this execution
	traceID := uuid.New().String()
	if execution.Metadata == nil {
		execution.Metadata = make(map[string]any)
	}
	execution.Metadata["traceId"] = traceID

	if err := e.executionRepo.Create(ctx, execution); err != nil {
		return nil, fmt.Errorf("failed to create execution: %w", err)
	}

	logger.Log.Infow("Starting workflow execution",
		"workflowId", workflow.ID.Hex(),
		"executionId", execution.ID.Hex(),
		"triggerType", req.TriggerType,
	)

	// Build node graph
	graph := e.buildNodeGraph(workflow)

	// Find trigger node (entry point)
	// If TriggerPath is specified, find the matching trigger node
	var triggerNode *domain.Node
	if req.TriggerPath != "" {
		triggerNode = e.findTriggerNodeByPath(workflow.Nodes, req.TriggerPath)
	} else {
		triggerNode = e.findTriggerNode(workflow.Nodes)
	}
	if triggerNode == nil {
		err := fmt.Errorf("no trigger node found in workflow")
		execution.Status = domain.ExecutionStatusFailed
		execution.Error = &domain.ExecutionError{Message: err.Error()}
		e.executionRepo.Update(ctx, execution)
		return nil, err
	}

	// Execute the workflow starting from trigger node
	output, execErr := e.executeNode(ctx, workflow, execution, triggerNode, req.Input, nil, req.Input, graph)

	// Update execution record
	duration := time.Since(startTime).Milliseconds()
	execution.Duration = duration
	now := time.Now()
	execution.CompletedAt = &now

	if execErr != nil {
		execution.Status = domain.ExecutionStatusFailed
		execution.Error = &domain.ExecutionError{
			Message: execErr.Error(),
		}
	} else {
		execution.Status = domain.ExecutionStatusCompleted
		execution.Output = output
	}

	e.executionRepo.Update(ctx, execution)

	logger.Log.Infow("Workflow execution completed",
		"workflowId", workflow.ID.Hex(),
		"executionId", execution.ID.Hex(),
		"status", execution.Status,
		"duration", duration,
	)

	return &ExecuteResult{
		ExecutionID: execution.ID.Hex(),
		Status:      execution.Status,
		Output:      execution.Output,
		Error:       execution.Error,
		Duration:    duration,
	}, nil
}

// NodeGraph represents the workflow as a graph
type NodeGraph struct {
	Nodes   map[string]*domain.Node
	Edges   map[string][]domain.Edge // nodeID -> outgoing edges
	InEdges map[string][]domain.Edge // nodeID -> incoming edges
}

func (e *FlowExecutor) buildNodeGraph(workflow *domain.Workflow) *NodeGraph {
	graph := &NodeGraph{
		Nodes:   make(map[string]*domain.Node),
		Edges:   make(map[string][]domain.Edge),
		InEdges: make(map[string][]domain.Edge),
	}

	for i := range workflow.Nodes {
		n := &workflow.Nodes[i]
		graph.Nodes[n.ID] = n
	}

	for _, edge := range workflow.Edges {
		graph.Edges[edge.Source] = append(graph.Edges[edge.Source], edge)
		graph.InEdges[edge.Target] = append(graph.InEdges[edge.Target], edge)
	}

	return graph
}

func (e *FlowExecutor) findTriggerNode(nodes []domain.Node) *domain.Node {
	for i := range nodes {
		if nodes[i].Type == domain.NodeTypeTrigger {
			return &nodes[i]
		}
	}
	return nil
}

// findTriggerNodeByPath finds a trigger node with matching webhookPath
func (e *FlowExecutor) findTriggerNodeByPath(nodes []domain.Node, path string) *domain.Node {
	for i := range nodes {
		if nodes[i].Type == domain.NodeTypeTrigger {
			if nodes[i].Data.WebhookPath == path {
				return &nodes[i]
			}
		}
	}
	// Fallback: return first trigger if no match
	return e.findTriggerNode(nodes)
}

func (e *FlowExecutor) executeNode(
	ctx context.Context,
	workflow *domain.Workflow,
	execution *domain.Execution,
	currentNode *domain.Node,
	input map[string]any,
	previousInput map[string]any,
	triggerInput map[string]any,
	graph *NodeGraph,
) (map[string]any, error) {
	startTime := time.Now()

	// Get TraceID from execution metadata
	traceID := ""
	if execution.Metadata != nil {
		if tid, ok := execution.Metadata["traceId"].(string); ok {
			traceID = tid
		}
	}

	// Get executor for this node type
	executor, ok := e.nodeRegistry.Get(currentNode.Type)
	if !ok {
		return nil, fmt.Errorf("no executor found for node type: %s", currentNode.Type)
	}

	// Prepare node data - for Transform nodes, load mappings from NodeSchema
	nodeData := currentNode.Data
	if currentNode.Type == domain.NodeTypeTransform && e.nodeSchemaRepo != nil {
		schema, err := e.nodeSchemaRepo.GetByNode(ctx, workflow.ID.Hex(), currentNode.ID)
		if err == nil && schema != nil && len(schema.Connections) > 0 {
			// Convert connections to mapping rules
			mappingRules := make([]domain.MappingRule, 0, len(schema.Connections))
			for _, conn := range schema.Connections {
				mappingRules = append(mappingRules, domain.MappingRule{
					SourceField: conn.SourceField,
					TargetField: conn.TargetField,
					Transform:   conn.TransformType,
				})
			}
			nodeData.MappingRules = mappingRules
		}
	}

	// Create execution context
	execCtx := &node.ExecutionContext{
		WorkflowID:    workflow.ID.Hex(),
		ExecutionID:   execution.ID.Hex(),
		NodeID:        currentNode.ID,
		TraceID:       traceID,
		Input:         input,
		PreviousInput: previousInput,
		TriggerInput:  triggerInput,
		Variables:     workflow.Variables,
	}

	// Execute node
	result, err := executor.Execute(ctx, execCtx, nodeData)

	// Record node execution log
	nodeLog := domain.NodeExecutionLog{
		NodeID:    currentNode.ID,
		NodeType:  currentNode.Type,
		NodeLabel: currentNode.Label,
		Input:     input,
		StartedAt: startTime,
	}

	now := time.Now()
	nodeLog.CompletedAt = &now
	nodeLog.Duration = time.Since(startTime).Milliseconds()

	if err != nil || (result != nil && result.Error != nil) {
		nodeLog.Status = domain.ExecutionStatusFailed
		errMsg := ""
		if err != nil {
			errMsg = err.Error()
		} else if result.Error != nil {
			errMsg = result.Error.Error()
		}
		nodeLog.Error = &errMsg
	} else {
		nodeLog.Status = domain.ExecutionStatusCompleted
		nodeLog.Output = result.Output
	}

	if result != nil {
		nodeLog.Logs = result.Logs
	}

	execution.NodeLogs = append(execution.NodeLogs, nodeLog)

	if err != nil {
		return nil, err
	}
	if result.Error != nil {
		return nil, result.Error
	}

	// Find next node(s) based on output port
	nextEdges := graph.Edges[currentNode.ID]
	for _, edge := range nextEdges {
		// Check if this edge matches the output port
		if edge.SourceHandle != "" && result.NextPort != "" && edge.SourceHandle != result.NextPort {
			continue
		}

		nextNode, ok := graph.Nodes[edge.Target]
		if !ok {
			continue
		}

		// Execute next node with current output as input
		// Pass current input as previousInput for next node
		return e.executeNode(ctx, workflow, execution, nextNode, result.Output, execCtx.Input, execCtx.TriggerInput, graph)
	}

	// No more nodes to execute, return final output
	return result.Output, nil
}

// ExecuteByEndpoint executes a workflow by its endpoint path
func (e *FlowExecutor) ExecuteByEndpoint(ctx context.Context, path string, input map[string]any) (*ExecuteResult, error) {
	workflow, err := e.workflowRepo.GetByEndpointPath(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("failed to get workflow by endpoint: %w", err)
	}
	if workflow == nil {
		return nil, fmt.Errorf("no active workflow found for endpoint: %s", path)
	}

	return e.Execute(ctx, &ExecuteRequest{
		WorkflowID:  workflow.ID,
		TriggerType: "webhook",
		TriggerPath: path, // Pass trigger path to find specific trigger node
		Input:       input,
		Metadata: map[string]any{
			"endpoint":  path,
			"requestId": uuid.New().String(),
		},
	})
}
