package node

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/nodetl/nodetl/internal/domain"
)

// ResponseNode sends a response back to the caller
type ResponseNode struct{}

func (n *ResponseNode) GetType() string {
	return "response"
}

func (n *ResponseNode) Validate(nodeData domain.NodeData) error {
	return nil
}

// TemplateEngine handles template processing with loops and conditionals
type TemplateEngine struct {
	data map[string]any
}

// NewTemplateEngine creates a new template engine with data context
func NewTemplateEngine(data map[string]any) *TemplateEngine {
	return &TemplateEngine{data: data}
}

// Process processes the template string and returns parsed JSON
func (te *TemplateEngine) Process(template string) (any, error) {
	// Process the template
	processed := te.processString(template, te.data)
	
	// Try to parse as JSON
	var result any
	if err := json.Unmarshal([]byte(processed), &result); err != nil {
		return nil, fmt.Errorf("invalid JSON after template processing: %v", err)
	}
	return result, nil
}

// processString processes template with given context data
func (te *TemplateEngine) processString(template string, contextData map[string]any) string {
	result := template
	
	// Process {{#each array}}...{{/each}} loops
	result = te.processEachBlocks(result, contextData)
	
	// Process {{#if condition}}...{{/if}} conditionals
	result = te.processIfBlocks(result, contextData)
	
	// Process {{#unless condition}}...{{/unless}} conditionals
	result = te.processUnlessBlocks(result, contextData)
	
	// Process simple {{field}} placeholders
	result = te.processPlaceholders(result, contextData)
	
	return result
}

// processEachBlocks handles {{#each items}}...{{/each}} loops
func (te *TemplateEngine) processEachBlocks(template string, contextData map[string]any) string {
	// Regex to match {{#each arrayPath}}content{{/each}}
	re := regexp.MustCompile(`(?s)\{\{#each\s+([^}]+)\}\}(.*?)\{\{/each\}\}`)
	
	return re.ReplaceAllStringFunc(template, func(match string) string {
		submatches := re.FindStringSubmatch(match)
		if len(submatches) < 3 {
			return match
		}
		
		arrayPath := strings.TrimSpace(submatches[1])
		innerTemplate := submatches[2]
		
		// Get the array from data
		arrayValue := getNestedValue(contextData, arrayPath)
		if arrayValue == nil {
			return ""
		}
		
		// Convert to slice
		var items []any
		switch v := arrayValue.(type) {
		case []any:
			items = v
		case []map[string]any:
			for _, item := range v {
				items = append(items, item)
			}
		default:
			return ""
		}
		
		if len(items) == 0 {
			return ""
		}
		
		// Process each item
		var results []string
		for i, item := range items {
			itemContext := make(map[string]any)
			// Copy parent context
			for k, v := range contextData {
				itemContext[k] = v
			}
			
			// Add item to context
			if itemMap, ok := item.(map[string]any); ok {
				// If item is a map, merge its fields into context
				for k, v := range itemMap {
					itemContext[k] = v
				}
				itemContext["this"] = itemMap
			} else {
				itemContext["this"] = item
			}
			itemContext["@index"] = i
			itemContext["@first"] = i == 0
			itemContext["@last"] = i == len(items)-1
			
			// Process the inner template with item context
			processed := te.processString(innerTemplate, itemContext)
			results = append(results, strings.TrimSpace(processed))
		}
		
		// Join without separator - let template control comma placement with {{#unless @last}},{{/unless}}
		return strings.Join(results, "")
	})
}

// processIfBlocks handles {{#if condition}}...{{else}}...{{/if}}
func (te *TemplateEngine) processIfBlocks(template string, contextData map[string]any) string {
	// Regex to match {{#if condition}}trueContent{{else}}falseContent{{/if}} or {{#if condition}}content{{/if}}
	re := regexp.MustCompile(`(?s)\{\{#if\s+([^}]+)\}\}(.*?)(?:\{\{else\}\}(.*?))?\{\{/if\}\}`)
	
	return re.ReplaceAllStringFunc(template, func(match string) string {
		submatches := re.FindStringSubmatch(match)
		if len(submatches) < 3 {
			return match
		}
		
		condition := strings.TrimSpace(submatches[1])
		trueContent := submatches[2]
		falseContent := ""
		if len(submatches) > 3 {
			falseContent = submatches[3]
		}
		
		// Evaluate condition
		if te.evaluateCondition(condition, contextData) {
			return te.processString(trueContent, contextData)
		}
		return te.processString(falseContent, contextData)
	})
}

// processUnlessBlocks handles {{#unless condition}}...{{/unless}}
func (te *TemplateEngine) processUnlessBlocks(template string, contextData map[string]any) string {
	// Regex to match {{#unless condition}}content{{/unless}}
	re := regexp.MustCompile(`(?s)\{\{#unless\s+([^}]+)\}\}(.*?)\{\{/unless\}\}`)
	
	return re.ReplaceAllStringFunc(template, func(match string) string {
		submatches := re.FindStringSubmatch(match)
		if len(submatches) < 3 {
			return match
		}
		
		condition := strings.TrimSpace(submatches[1])
		content := submatches[2]
		
		// Evaluate condition (inverse of if)
		if !te.evaluateCondition(condition, contextData) {
			return te.processString(content, contextData)
		}
		return ""
	})
}

// evaluateCondition evaluates a condition expression
func (te *TemplateEngine) evaluateCondition(condition string, contextData map[string]any) bool {
	condition = strings.TrimSpace(condition)
	
	// Check for comparison operators
	operators := []string{"===", "!==", "==", "!=", ">=", "<=", ">", "<"}
	for _, op := range operators {
		if strings.Contains(condition, op) {
			parts := strings.SplitN(condition, op, 2)
			if len(parts) == 2 {
				left := te.resolveValue(strings.TrimSpace(parts[0]), contextData)
				right := te.resolveValue(strings.TrimSpace(parts[1]), contextData)
				return te.compare(left, right, op)
			}
		}
	}
	
	// Simple truthy check
	value := getNestedValue(contextData, condition)
	return te.isTruthy(value)
}

// resolveValue resolves a value from context or returns literal
func (te *TemplateEngine) resolveValue(expr string, contextData map[string]any) any {
	expr = strings.TrimSpace(expr)
	
	// Check for string literal
	if (strings.HasPrefix(expr, "\"") && strings.HasSuffix(expr, "\"")) ||
		(strings.HasPrefix(expr, "'") && strings.HasSuffix(expr, "'")) {
		return expr[1 : len(expr)-1]
	}
	
	// Check for number
	if num, err := strconv.ParseFloat(expr, 64); err == nil {
		return num
	}
	
	// Check for boolean
	if expr == "true" {
		return true
	}
	if expr == "false" {
		return false
	}
	
	// Check for null
	if expr == "null" || expr == "nil" {
		return nil
	}
	
	// Resolve from context
	return getNestedValue(contextData, expr)
}

// compare compares two values with an operator
func (te *TemplateEngine) compare(left, right any, op string) bool {
	switch op {
	case "==", "===":
		return fmt.Sprintf("%v", left) == fmt.Sprintf("%v", right)
	case "!=", "!==":
		return fmt.Sprintf("%v", left) != fmt.Sprintf("%v", right)
	case ">":
		return te.toFloat(left) > te.toFloat(right)
	case ">=":
		return te.toFloat(left) >= te.toFloat(right)
	case "<":
		return te.toFloat(left) < te.toFloat(right)
	case "<=":
		return te.toFloat(left) <= te.toFloat(right)
	}
	return false
}

// toFloat converts a value to float64
func (te *TemplateEngine) toFloat(v any) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case string:
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			return f
		}
	}
	return 0
}

// isTruthy checks if a value is truthy
func (te *TemplateEngine) isTruthy(v any) bool {
	if v == nil {
		return false
	}
	switch val := v.(type) {
	case bool:
		return val
	case string:
		return val != ""
	case int, int64, float64:
		return val != 0
	case []any:
		return len(val) > 0
	case map[string]any:
		return len(val) > 0
	}
	return true
}

// processPlaceholders handles simple {{field}} placeholders
func (te *TemplateEngine) processPlaceholders(template string, contextData map[string]any) string {
	// Regex to match {{field.path}} placeholders (but not block helpers)
	re := regexp.MustCompile(`"?\{\{([^#/][^}]*)\}\}"?`)
	
	return re.ReplaceAllStringFunc(template, func(match string) string {
		// Extract field path
		fieldPath := strings.TrimPrefix(match, "\"")
		fieldPath = strings.TrimSuffix(fieldPath, "\"")
		fieldPath = strings.TrimPrefix(fieldPath, "{{")
		fieldPath = strings.TrimSuffix(fieldPath, "}}")
		fieldPath = strings.TrimSpace(fieldPath)
		
		// Skip if it looks like a helper
		if strings.HasPrefix(fieldPath, "#") || strings.HasPrefix(fieldPath, "/") {
			return match
		}
		
		// Get value from context
		value := getNestedValue(contextData, fieldPath)
		
		// Convert value to JSON string
		if value == nil {
			return "null"
		}
		
		jsonValue, err := json.Marshal(value)
		if err != nil {
			return "null"
		}
		return string(jsonValue)
	})
}

// processTemplate is the main entry point for template processing
func processTemplate(template string, data map[string]any) (any, error) {
	engine := NewTemplateEngine(data)
	return engine.Process(template)
}

// buildErrorResponse creates an error response based on config
func (n *ResponseNode) buildErrorResponse(execCtx *ExecutionContext, config *domain.ResponseConfig, errType string, errMsg string, defaultStatusCode int) (int, any) {
	statusCode := defaultStatusCode
	traceID := execCtx.TraceID
	
	errorData := map[string]any{
		"error":    errType,
		"message":  errMsg,
		"success":  false,
	}
	
	// Include trace ID if configured or by default
	includeTraceID := true
	if config.ErrorConfig != nil {
		includeTraceID = config.ErrorConfig.IncludeTraceID
		
		// Override status code if specified
		if config.ErrorConfig.ErrorStatusCode > 0 {
			statusCode = config.ErrorConfig.ErrorStatusCode
		}
		
		// Check specific error type configs
		var specificConfig *domain.ValidationConfig
		switch errType {
		case "validation_error", "bad_request":
			specificConfig = config.ErrorConfig.ValidationErrors
			if specificConfig == nil && defaultStatusCode == 0 {
				statusCode = 400
			}
		case "not_found":
			specificConfig = config.ErrorConfig.NotFoundErrors
			if specificConfig == nil && defaultStatusCode == 0 {
				statusCode = 404
			}
		case "unauthorized":
			specificConfig = config.ErrorConfig.UnauthorizedErrors
			if specificConfig == nil && defaultStatusCode == 0 {
				statusCode = 401
			}
		case "forbidden":
			specificConfig = config.ErrorConfig.ForbiddenErrors
			if specificConfig == nil && defaultStatusCode == 0 {
				statusCode = 403
			}
		default:
			if statusCode == 0 {
				statusCode = 500
			}
		}
		
		// Use specific config if available
		if specificConfig != nil && specificConfig.Enabled {
			if specificConfig.StatusCode > 0 {
				statusCode = specificConfig.StatusCode
			}
			if specificConfig.Template != "" {
				// Process custom template for this error type
				templateData := map[string]any{
					"error":     errType,
					"message":   errMsg,
					"traceId":   traceID,
					"timestamp": time.Now().UTC().Format(time.RFC3339),
				}
				// Merge with input data
				for k, v := range execCtx.Input {
					templateData[k] = v
				}
				if result, err := processTemplate(specificConfig.Template, templateData); err == nil {
					return statusCode, result
				}
			}
		}
		
		// Use custom error template if configured
		if config.ErrorConfig.UseCustomTemplate && config.ErrorConfig.ErrorTemplate != "" {
			templateData := map[string]any{
				"error":      errType,
				"message":    errMsg,
				"traceId":    traceID,
				"statusCode": statusCode,
				"timestamp":  time.Now().UTC().Format(time.RFC3339),
			}
			// Merge with input data
			for k, v := range execCtx.Input {
				templateData[k] = v
			}
			if result, err := processTemplate(config.ErrorConfig.ErrorTemplate, templateData); err == nil {
				return statusCode, result
			}
		}
	}
	
	if includeTraceID && traceID != "" {
		errorData["traceId"] = traceID
	}
	errorData["timestamp"] = time.Now().UTC().Format(time.RFC3339)
	
	return statusCode, errorData
}

func (n *ResponseNode) Execute(ctx context.Context, execCtx *ExecutionContext, nodeData domain.NodeData) (*ExecutionResult, error) {
	logs := []domain.LogEntry{}
	response := make(map[string]any)
	
	// Default values
	statusCode := 200
	headers := make(map[string]string)
	var finalBody any = execCtx.Input
	
	// Use ResponseConfig if configured
	if nodeData.ResponseConfig != nil {
		config := nodeData.ResponseConfig
		
		// Status code
		if config.StatusCode > 0 {
			statusCode = config.StatusCode
		}
		
		// Headers
		if config.Headers != nil {
			headers = config.Headers
		}
		
		// Check if there's an error from previous nodes
		if execCtx.Error != nil {
			errStatusCode, errBody := n.buildErrorResponse(execCtx, config, execCtx.Error.Type, execCtx.Error.Message, execCtx.Error.StatusCode)
			statusCode = errStatusCode
			finalBody = errBody
			
			logs = append(logs, domain.LogEntry{
				Level:     "error",
				Message:   "Error response prepared",
				Timestamp: time.Now(),
				Data:      map[string]any{"error": execCtx.Error, "traceId": execCtx.TraceID},
			})
		} else if config.UseTemplate && config.ResponseTemplate != "" {
			// Use template if enabled
			templateBody, err := processTemplate(config.ResponseTemplate, execCtx.Input)
			if err != nil {
				logs = append(logs, domain.LogEntry{
					Level:     "error",
					Message:   "Failed to process response template",
					Timestamp: time.Now(),
					Data:      map[string]any{"error": err.Error(), "traceId": execCtx.TraceID},
				})
				// Return error response
				errStatusCode, errBody := n.buildErrorResponse(execCtx, config, "template_error", err.Error(), 500)
				statusCode = errStatusCode
				finalBody = errBody
			} else {
				finalBody = templateBody
			}
		} else {
			// Build body from selected fields
			body := make(map[string]any)
			if len(config.SelectedFields) > 0 {
				for _, field := range config.SelectedFields {
					sourceData := execCtx.Input
					value := getNestedValue(sourceData, field.FieldPath)
					targetPath := field.FieldPath
					if field.Alias != "" {
						targetPath = field.Alias
					}
					setNestedValue(body, targetPath, value)
				}
				finalBody = body
			}
		}
	}
	
	response["statusCode"] = statusCode
	response["headers"] = headers
	response["body"] = finalBody
	
	logs = append(logs, domain.LogEntry{
		Level:     "info",
		Message:   "Response prepared",
		Timestamp: time.Now(),
		Data:      map[string]any{"statusCode": statusCode, "traceId": execCtx.TraceID},
	})
	
	return &ExecutionResult{
		Output:   response,
		Logs:     logs,
		NextPort: "", // End of flow
	}, nil
}

func init() {
	GetRegistry().Register(&ResponseNode{})
}
