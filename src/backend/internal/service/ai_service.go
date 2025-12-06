package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// AIService handles AI-powered features
type AIService struct {
	apiKey     string
	apiURL     string
	model      string
	httpClient *http.Client
}

// NewAIService creates a new AI service
func NewAIService() *AIService {
	apiKey := os.Getenv("OPENAI_API_KEY")
	apiURL := os.Getenv("OPENAI_API_URL")
	model := os.Getenv("OPENAI_MODEL")

	if apiURL == "" {
		apiURL = "https://api.openai.com/v1/chat/completions"
	}
	if model == "" {
		model = "gpt-3.5-turbo"
	}

	return &AIService{
		apiKey: apiKey,
		apiURL: apiURL,
		model:  model,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// IsEnabled checks if AI service is configured
func (s *AIService) IsEnabled() bool {
	return s.apiKey != ""
}

// GenerateTestDataRequest contains the request for generating test data
type GenerateTestDataRequest struct {
	SourceSchema map[string]any `json:"sourceSchema"`
	Description  string         `json:"description,omitempty"`
	Count        int            `json:"count,omitempty"`
}

// GenerateTestDataResponse contains the generated test data
type GenerateTestDataResponse struct {
	TestData    []map[string]any `json:"testData"`
	Description string           `json:"description"`
}

// ChatMessage represents a message in the chat
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest represents the OpenAI chat request
type ChatRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float64       `json:"temperature"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
}

// ChatResponse represents the OpenAI chat response
type ChatResponse struct {
	Choices []struct {
		Message ChatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// GenerateTestData generates test data based on source schema using AI
func (s *AIService) GenerateTestData(req *GenerateTestDataRequest) (*GenerateTestDataResponse, error) {
	if !s.IsEnabled() {
		return nil, fmt.Errorf("AI service is not configured. Please set OPENAI_API_KEY environment variable")
	}

	count := req.Count
	if count <= 0 {
		count = 3
	}
	if count > 10 {
		count = 10
	}

	// Build the prompt
	schemaJSON, _ := json.MarshalIndent(req.SourceSchema, "", "  ")
	
	prompt := fmt.Sprintf(`Generate %d realistic test data samples based on this JSON schema/structure:

%s

Requirements:
1. Generate exactly %d different test data objects
2. Use realistic values that match the field names and types
3. Vary the data between samples (don't use identical values)
4. For strings: use realistic names, emails, addresses, etc based on field name
5. For numbers: use appropriate ranges based on field name (age: 18-80, price: 1-1000, etc)
6. For booleans: mix true/false values
7. For arrays: include 1-5 items with varied data
8. For nested objects: populate all fields

%s

Return ONLY a valid JSON array with the test data objects. No explanations or markdown.
Example format: [{"field1": "value1"}, {"field1": "value2"}]`,
		count, string(schemaJSON), count,
		func() string {
			if req.Description != "" {
				return fmt.Sprintf("Additional context: %s", req.Description)
			}
			return ""
		}())

	// Call OpenAI API
	chatReq := ChatRequest{
		Model: s.model,
		Messages: []ChatMessage{
			{
				Role:    "system",
				Content: "You are a test data generator. You generate realistic JSON test data based on schemas. Always return valid JSON arrays only, no markdown or explanations.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
		Temperature: 0.7,
		MaxTokens:   2000,
	}

	reqBody, err := json.Marshal(chatReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", s.apiURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to call AI API: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if chatResp.Error != nil {
		return nil, fmt.Errorf("AI API error: %s", chatResp.Error.Message)
	}

	if len(chatResp.Choices) == 0 {
		return nil, fmt.Errorf("no response from AI")
	}

	// Parse the generated JSON
	content := strings.TrimSpace(chatResp.Choices[0].Message.Content)
	
	// Remove markdown code blocks if present
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var testData []map[string]any
	if err := json.Unmarshal([]byte(content), &testData); err != nil {
		// Try to parse as single object
		var singleData map[string]any
		if err2 := json.Unmarshal([]byte(content), &singleData); err2 != nil {
			return nil, fmt.Errorf("failed to parse generated data: %w (content: %s)", err, content)
		}
		testData = []map[string]any{singleData}
	}

	return &GenerateTestDataResponse{
		TestData:    testData,
		Description: fmt.Sprintf("Generated %d test data samples based on schema", len(testData)),
	}, nil
}

// GenerateTestDataFromSample generates test data based on a sample JSON
func (s *AIService) GenerateTestDataFromSample(sample map[string]any, count int) (*GenerateTestDataResponse, error) {
	return s.GenerateTestData(&GenerateTestDataRequest{
		SourceSchema: sample,
		Count:        count,
	})
}
