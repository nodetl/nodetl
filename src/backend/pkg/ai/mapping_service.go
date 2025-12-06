package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/nodetl/nodetl/config"
	"github.com/nodetl/nodetl/internal/domain"
)

// MappingService provides AI-powered field mapping suggestions
type MappingService struct {
	config     *config.AIConfig
	httpClient *http.Client
}

// NewMappingService creates a new AI mapping service
func NewMappingService(cfg *config.AIConfig) *MappingService {
	return &MappingService{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// SuggestMapping uses AI to suggest field mappings between schemas
func (s *MappingService) SuggestMapping(ctx context.Context, req *domain.AIMappingRequest) (*domain.AIMappingResponse, error) {
	if s.config.OpenAIKey == "" {
		// Fallback to rule-based mapping if no API key
		return s.fallbackMapping(req)
	}
	
	prompt := s.buildPrompt(req)
	
	// Call OpenAI API
	response, err := s.callOpenAI(ctx, prompt)
	if err != nil {
		// Fallback on API error
		return s.fallbackMapping(req)
	}
	
	return response, nil
}

func (s *MappingService) buildPrompt(req *domain.AIMappingRequest) string {
	sourceFields := formatFields(req.SourceSchema.Fields)
	targetFields := formatFields(req.TargetSchema.Fields)
	
	prompt := fmt.Sprintf(`You are an expert data mapper. Given a source schema and target schema, suggest field mappings.

Source Schema: %s
Source Fields:
%s

Target Schema: %s  
Target Fields:
%s

`, req.SourceSchema.Name, sourceFields, req.TargetSchema.Name, targetFields)

	if len(req.SampleData) > 0 {
		sampleJSON, _ := json.MarshalIndent(req.SampleData, "", "  ")
		prompt += fmt.Sprintf("\nSample Source Data:\n%s\n", string(sampleJSON))
	}
	
	if req.Instructions != "" {
		prompt += fmt.Sprintf("\nAdditional Instructions: %s\n", req.Instructions)
	}
	
	prompt += `
Please respond with a JSON object containing:
1. "rules": array of mapping rules, each with:
   - "id": unique identifier
   - "sourceField": source field path (dot notation for nested)
   - "targetField": target field path
   - "transform": transformation type (direct, concat, split, toString, toNumber, etc.) or empty for direct copy
   - "defaultValue": default value if source is null (optional)
2. "confidence": overall confidence score (0.0 to 1.0)
3. "explanation": brief explanation of the mapping strategy
4. "suggestions": array of suggestions for the user

Respond ONLY with valid JSON, no markdown or other text.`

	return prompt
}

func formatFields(fields []domain.SchemaField) string {
	result := ""
	for _, f := range fields {
		required := ""
		if f.Required {
			required = " (required)"
		}
		result += fmt.Sprintf("- %s: %s%s - %s\n", f.Path, f.Type, required, f.Description)
		for _, child := range f.Children {
			result += fmt.Sprintf("  - %s: %s - %s\n", child.Path, child.Type, child.Description)
		}
	}
	return result
}

type openAIRequest struct {
	Model    string          `json:"model"`
	Messages []openAIMessage `json:"messages"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (s *MappingService) callOpenAI(ctx context.Context, prompt string) (*domain.AIMappingResponse, error) {
	reqBody := openAIRequest{
		Model: s.config.OpenAIModel,
		Messages: []openAIMessage{
			{Role: "system", Content: "You are a data mapping expert. Always respond with valid JSON only."},
			{Role: "user", Content: prompt},
		},
	}
	
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.config.OpenAIKey)
	
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	var openAIResp openAIResponse
	if err := json.Unmarshal(body, &openAIResp); err != nil {
		return nil, err
	}
	
	if openAIResp.Error != nil {
		return nil, fmt.Errorf("OpenAI API error: %s", openAIResp.Error.Message)
	}
	
	if len(openAIResp.Choices) == 0 {
		return nil, fmt.Errorf("no response from OpenAI")
	}
	
	// Parse the response
	var mappingResp domain.AIMappingResponse
	if err := json.Unmarshal([]byte(openAIResp.Choices[0].Message.Content), &mappingResp); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w", err)
	}
	
	return &mappingResp, nil
}

// fallbackMapping provides rule-based mapping when AI is not available
func (s *MappingService) fallbackMapping(req *domain.AIMappingRequest) (*domain.AIMappingResponse, error) {
	rules := []domain.MappingRule{}
	
	// Build a map of target fields for matching
	targetFieldMap := make(map[string]domain.SchemaField)
	for _, f := range req.TargetSchema.Fields {
		targetFieldMap[normalizeFieldName(f.Name)] = f
		for _, child := range f.Children {
			targetFieldMap[normalizeFieldName(child.Name)] = child
		}
	}
	
	// Match source fields to target fields
	for _, sourceField := range req.SourceSchema.Fields {
		s.matchField(sourceField, targetFieldMap, &rules)
		for _, child := range sourceField.Children {
			s.matchField(child, targetFieldMap, &rules)
		}
	}
	
	confidence := 0.5
	if len(rules) > 0 {
		confidence = float64(len(rules)) / float64(len(req.TargetSchema.Fields))
		if confidence > 0.9 {
			confidence = 0.9
		}
	}
	
	return &domain.AIMappingResponse{
		Rules:      rules,
		Confidence: confidence,
		Explanation: "Mapping generated using field name matching. Some fields may require manual adjustment.",
		Suggestions: []string{
			"Review the mapped fields for accuracy",
			"Add transformations for fields that need data conversion",
			"Set default values for optional target fields",
		},
	}, nil
}

func (s *MappingService) matchField(sourceField domain.SchemaField, targetFieldMap map[string]domain.SchemaField, rules *[]domain.MappingRule) {
	normalized := normalizeFieldName(sourceField.Name)
	
	if targetField, ok := targetFieldMap[normalized]; ok {
		rule := domain.MappingRule{
			ID:          fmt.Sprintf("rule_%d", len(*rules)+1),
			SourceField: sourceField.Path,
			TargetField: targetField.Path,
		}
		
		// Add transform if types differ
		if sourceField.Type != targetField.Type {
			switch targetField.Type {
			case "string":
				rule.Transform = "toString"
			case "number":
				rule.Transform = "toNumber"
			case "boolean":
				rule.Transform = "toBoolean"
			}
		}
		
		*rules = append(*rules, rule)
	}
}

func normalizeFieldName(name string) string {
	// Convert to lowercase and remove common prefixes/suffixes
	name = string(bytes.ToLower([]byte(name)))
	
	// Common variations mapping
	variations := map[string]string{
		"firstname":    "firstname",
		"first_name":   "firstname",
		"fname":        "firstname",
		"lastname":     "lastname",
		"last_name":    "lastname",
		"lname":        "lastname",
		"emailaddress": "email",
		"email_address": "email",
		"phonenumber":  "phone",
		"phone_number": "phone",
		"zipcode":      "postalcode",
		"zip_code":     "postalcode",
		"zip":          "postalcode",
		"postal_code":  "postalcode",
	}
	
	if normalized, ok := variations[name]; ok {
		return normalized
	}
	
	return name
}
