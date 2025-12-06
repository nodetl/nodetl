package node

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/nodetl/nodetl/internal/domain"
)

// TransformNode transforms data according to mapping rules
type TransformNode struct{}

func (n *TransformNode) GetType() string {
	return domain.NodeTypeTransform
}

func (n *TransformNode) Validate(nodeData domain.NodeData) error {
	if len(nodeData.MappingRules) == 0 {
		return fmt.Errorf("transform node requires at least one mapping rule")
	}
	return nil
}

func (n *TransformNode) Execute(ctx context.Context, execCtx *ExecutionContext, nodeData domain.NodeData) (*ExecutionResult, error) {
	input := execCtx.Input
	output := make(map[string]any)
	logs := []domain.LogEntry{}

	for _, rule := range nodeData.MappingRules {
		// Get source value
		sourceValue := getNestedValue(input, rule.SourceField)
		
		// Apply transformation if specified
		transformedValue := sourceValue
		if rule.Transform != "" {
			var err error
			transformedValue, err = applyTransform(sourceValue, rule.Transform)
			if err != nil {
				logs = append(logs, domain.LogEntry{
					Level:     "warn",
					Message:   fmt.Sprintf("Transform failed for field %s: %v", rule.SourceField, err),
					Timestamp: time.Now(),
				})
				// Use default value if transform fails
				if rule.DefaultValue != nil {
					transformedValue = rule.DefaultValue
				}
			}
		}
		
		// Use default value if source is nil
		if transformedValue == nil && rule.DefaultValue != nil {
			transformedValue = rule.DefaultValue
		}
		
		// Set target value
		setNestedValue(output, rule.TargetField, transformedValue)
		
		logs = append(logs, domain.LogEntry{
			Level:     "debug",
			Message:   fmt.Sprintf("Mapped %s -> %s", rule.SourceField, rule.TargetField),
			Timestamp: time.Now(),
			Data:      map[string]any{"value": transformedValue},
		})
	}

	return &ExecutionResult{
		Output:   output,
		Logs:     logs,
		NextPort: "output",
	}, nil
}

// getNestedValue gets a value from a nested map using dot notation
func getNestedValue(data map[string]any, path string) any {
	parts := strings.Split(path, ".")
	current := any(data)
	
	for _, part := range parts {
		if current == nil {
			return nil
		}
		
		switch v := current.(type) {
		case map[string]any:
			current = v[part]
		default:
			return nil
		}
	}
	
	return current
}

// setNestedValue sets a value in a nested map using dot notation
func setNestedValue(data map[string]any, path string, value any) {
	parts := strings.Split(path, ".")
	current := data
	
	for i, part := range parts {
		if i == len(parts)-1 {
			current[part] = value
		} else {
			if _, ok := current[part]; !ok {
				current[part] = make(map[string]any)
			}
			if next, ok := current[part].(map[string]any); ok {
				current = next
			} else {
				// Can't traverse further, create new map
				newMap := make(map[string]any)
				current[part] = newMap
				current = newMap
			}
		}
	}
}

// applyTransform applies a transformation to a value
func applyTransform(value any, transform string) (any, error) {
	if value == nil {
		return nil, nil
	}
	
	switch transform {
	case "toString":
		return fmt.Sprintf("%v", value), nil
	case "toNumber":
		switch v := value.(type) {
		case float64:
			return v, nil
		case float32:
			return float64(v), nil
		case int:
			return float64(v), nil
		case int64:
			return float64(v), nil
		case string:
			var f float64
			_, err := fmt.Sscanf(v, "%f", &f)
			return f, err
		default:
			return nil, fmt.Errorf("cannot convert %T to number", value)
		}
	case "lowercase":
		if s, ok := value.(string); ok {
			return strings.ToLower(s), nil
		}
		return value, nil
	case "uppercase":
		if s, ok := value.(string); ok {
			return strings.ToUpper(s), nil
		}
		return value, nil
	case "trim":
		if s, ok := value.(string); ok {
			return strings.TrimSpace(s), nil
		}
		return value, nil
	default:
		// Direct copy if no transform specified
		return value, nil
	}
}
