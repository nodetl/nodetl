package node

import (
	"context"
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"time"

	"github.com/nodetl/nodetl/internal/domain"
)

// ConditionNode branches workflow based on conditions
type ConditionNode struct{}

func (n *ConditionNode) GetType() string {
	return domain.NodeTypeCondition
}

func (n *ConditionNode) Validate(nodeData domain.NodeData) error {
	if len(nodeData.Conditions) == 0 {
		return fmt.Errorf("condition node requires at least one condition")
	}
	return nil
}

func (n *ConditionNode) Execute(ctx context.Context, execCtx *ExecutionContext, nodeData domain.NodeData) (*ExecutionResult, error) {
	input := execCtx.Input
	logs := []domain.LogEntry{}
	
	for _, condition := range nodeData.Conditions {
		fieldValue := getNestedValue(input, condition.Field)
		
		result := evaluateCondition(fieldValue, condition.Operator, condition.Value)
		
		logs = append(logs, domain.LogEntry{
			Level:     "debug",
			Message:   fmt.Sprintf("Evaluating condition: %s %s %v = %v", condition.Field, condition.Operator, condition.Value, result),
			Timestamp: time.Now(),
			Data: map[string]any{
				"field":      condition.Field,
				"operator":   condition.Operator,
				"expected":   condition.Value,
				"actual":     fieldValue,
				"result":     result,
			},
		})
		
		if result {
			return &ExecutionResult{
				Output:   input,
				Logs:     logs,
				NextPort: condition.OutputID,
			}, nil
		}
	}
	
	// No condition matched, use "false" output
	return &ExecutionResult{
		Output:   input,
		Logs:     logs,
		NextPort: "false",
	}, nil
}

func evaluateCondition(fieldValue any, operator string, expectedValue any) bool {
	switch operator {
	case "eq", "==", "equals":
		return reflect.DeepEqual(fieldValue, expectedValue)
		
	case "neq", "!=", "notEquals":
		return !reflect.DeepEqual(fieldValue, expectedValue)
		
	case "gt", ">":
		return compareNumbers(fieldValue, expectedValue) > 0
		
	case "gte", ">=":
		return compareNumbers(fieldValue, expectedValue) >= 0
		
	case "lt", "<":
		return compareNumbers(fieldValue, expectedValue) < 0
		
	case "lte", "<=":
		return compareNumbers(fieldValue, expectedValue) <= 0
		
	case "contains":
		if s, ok := fieldValue.(string); ok {
			if pattern, ok := expectedValue.(string); ok {
				return strings.Contains(s, pattern)
			}
		}
		return false
		
	case "startsWith":
		if s, ok := fieldValue.(string); ok {
			if pattern, ok := expectedValue.(string); ok {
				return strings.HasPrefix(s, pattern)
			}
		}
		return false
		
	case "endsWith":
		if s, ok := fieldValue.(string); ok {
			if pattern, ok := expectedValue.(string); ok {
				return strings.HasSuffix(s, pattern)
			}
		}
		return false
		
	case "regex", "matches":
		if s, ok := fieldValue.(string); ok {
			if pattern, ok := expectedValue.(string); ok {
				matched, _ := regexp.MatchString(pattern, s)
				return matched
			}
		}
		return false
		
	case "isNull", "isEmpty":
		return fieldValue == nil || fieldValue == ""
		
	case "isNotNull", "isNotEmpty":
		return fieldValue != nil && fieldValue != ""
		
	case "in":
		if arr, ok := expectedValue.([]any); ok {
			for _, item := range arr {
				if reflect.DeepEqual(fieldValue, item) {
					return true
				}
			}
		}
		return false
		
	default:
		return false
	}
}

func compareNumbers(a, b any) int {
	aFloat := toFloat64(a)
	bFloat := toFloat64(b)
	
	if aFloat < bFloat {
		return -1
	} else if aFloat > bFloat {
		return 1
	}
	return 0
}

func toFloat64(v any) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case float32:
		return float64(n)
	case int:
		return float64(n)
	case int32:
		return float64(n)
	case int64:
		return float64(n)
	default:
		return 0
	}
}
