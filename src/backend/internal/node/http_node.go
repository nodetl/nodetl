package node

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/nodetl/nodetl/internal/domain"
)

// HTTPNode makes HTTP requests to external APIs
type HTTPNode struct{}

func (n *HTTPNode) GetType() string {
	return domain.NodeTypeHTTP
}

func (n *HTTPNode) Validate(nodeData domain.NodeData) error {
	if nodeData.HTTPURL == "" {
		return fmt.Errorf("HTTP node requires a URL")
	}
	if nodeData.HTTPMethod == "" {
		return fmt.Errorf("HTTP node requires a method")
	}
	return nil
}

func (n *HTTPNode) Execute(ctx context.Context, execCtx *ExecutionContext, nodeData domain.NodeData) (*ExecutionResult, error) {
	logs := []domain.LogEntry{}
	
	// Prepare URL (replace variables)
	url := replaceVariables(nodeData.HTTPURL, execCtx.Input)
	
	// Prepare body
	var bodyReader io.Reader
	if nodeData.HTTPBody != "" {
		body := replaceVariables(nodeData.HTTPBody, execCtx.Input)
		bodyReader = bytes.NewBufferString(body)
	} else if nodeData.HTTPMethod != "GET" && nodeData.HTTPMethod != "DELETE" {
		// Use input as JSON body
		jsonBody, err := json.Marshal(execCtx.Input)
		if err == nil {
			bodyReader = bytes.NewBuffer(jsonBody)
		}
	}
	
	// Create request
	req, err := http.NewRequestWithContext(ctx, nodeData.HTTPMethod, url, bodyReader)
	if err != nil {
		return &ExecutionResult{
			Error:    err,
			NextPort: "error",
			Output:   map[string]any{"error": err.Error()},
		}, nil
	}
	
	// Set headers
	req.Header.Set("Content-Type", "application/json")
	for key, value := range nodeData.HTTPHeaders {
		req.Header.Set(key, replaceVariables(value, execCtx.Input))
	}
	
	logs = append(logs, domain.LogEntry{
		Level:     "info",
		Message:   fmt.Sprintf("Making %s request to %s", nodeData.HTTPMethod, url),
		Timestamp: time.Now(),
	})
	
	// Execute request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		logs = append(logs, domain.LogEntry{
			Level:     "error",
			Message:   fmt.Sprintf("Request failed: %v", err),
			Timestamp: time.Now(),
		})
		return &ExecutionResult{
			Error:    err,
			Logs:     logs,
			NextPort: "error",
			Output:   map[string]any{"error": err.Error()},
		}, nil
	}
	defer resp.Body.Close()
	
	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return &ExecutionResult{
			Error:    err,
			Logs:     logs,
			NextPort: "error",
			Output:   map[string]any{"error": err.Error()},
		}, nil
	}
	
	// Parse response
	var responseData any
	if err := json.Unmarshal(respBody, &responseData); err != nil {
		responseData = string(respBody)
	}
	
	output := map[string]any{
		"statusCode": resp.StatusCode,
		"headers":    headerToMap(resp.Header),
		"body":       responseData,
	}
	
	logs = append(logs, domain.LogEntry{
		Level:     "info",
		Message:   fmt.Sprintf("Received response with status %d", resp.StatusCode),
		Timestamp: time.Now(),
	})
	
	nextPort := "response"
	if resp.StatusCode >= 400 {
		nextPort = "error"
	}
	
	return &ExecutionResult{
		Output:   output,
		Logs:     logs,
		NextPort: nextPort,
	}, nil
}

// replaceVariables replaces {{variable}} patterns with actual values
func replaceVariables(template string, data map[string]any) string {
	result := template
	for key, value := range data {
		placeholder := fmt.Sprintf("{{%s}}", key)
		result = strings.ReplaceAll(result, placeholder, fmt.Sprintf("%v", value))
		
		// Also handle nested with dot notation
		if m, ok := value.(map[string]any); ok {
			for nestedKey, nestedValue := range m {
				nestedPlaceholder := fmt.Sprintf("{{%s.%s}}", key, nestedKey)
				result = strings.ReplaceAll(result, nestedPlaceholder, fmt.Sprintf("%v", nestedValue))
			}
		}
	}
	return result
}

func headerToMap(header http.Header) map[string]string {
	result := make(map[string]string)
	for key, values := range header {
		if len(values) > 0 {
			result[key] = values[0]
		}
	}
	return result
}
