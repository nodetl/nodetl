package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Schema represents a data schema (predefined or user-defined)
type Schema struct {
	ID          primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name        string             `json:"name" bson:"name"`
	Description string             `json:"description" bson:"description"`
	Version     string             `json:"version" bson:"version"`
	Type        SchemaType         `json:"type" bson:"type"`               // predefined or custom
	Category    string             `json:"category" bson:"category"`       // e-commerce, crm, erp, etc.
	Fields      []SchemaField      `json:"fields" bson:"fields"`
	JSONSchema  map[string]any     `json:"jsonSchema" bson:"json_schema"`  // Full JSON Schema representation
	Examples    []map[string]any   `json:"examples,omitempty" bson:"examples,omitempty"`
	CreatedAt   time.Time          `json:"createdAt" bson:"created_at"`
	UpdatedAt   time.Time          `json:"updatedAt" bson:"updated_at"`
	CreatedBy   string             `json:"createdBy" bson:"created_by"`
}

type SchemaType string

const (
	SchemaTypePredefined SchemaType = "predefined"
	SchemaTypeCustom     SchemaType = "custom"
)

type SchemaField struct {
	Name        string        `json:"name" bson:"name"`
	Path        string        `json:"path" bson:"path"`               // JSONPath for nested fields
	Type        string        `json:"type" bson:"type"`               // string, number, boolean, array, object
	Required    bool          `json:"required" bson:"required"`
	Description string        `json:"description" bson:"description"`
	Format      string        `json:"format,omitempty" bson:"format,omitempty"` // date-time, email, uri, etc.
	Enum        []any         `json:"enum,omitempty" bson:"enum,omitempty"`
	Default     any           `json:"default,omitempty" bson:"default,omitempty"`
	Children    []SchemaField `json:"children,omitempty" bson:"children,omitempty"` // for nested objects
}

// GetPredefinedSchemas returns all predefined standard schemas
func GetPredefinedSchemas() []Schema {
	return []Schema{
		{
			Name:        "Standard User",
			Description: "Standard user/customer data schema",
			Version:     "1.0.0",
			Type:        SchemaTypePredefined,
			Category:    "common",
			Fields: []SchemaField{
				{Name: "id", Path: "id", Type: "string", Required: true, Description: "Unique identifier"},
				{Name: "email", Path: "email", Type: "string", Required: true, Description: "Email address", Format: "email"},
				{Name: "firstName", Path: "firstName", Type: "string", Required: true, Description: "First name"},
				{Name: "lastName", Path: "lastName", Type: "string", Required: true, Description: "Last name"},
				{Name: "phone", Path: "phone", Type: "string", Required: false, Description: "Phone number"},
				{Name: "address", Path: "address", Type: "object", Required: false, Description: "Address information", Children: []SchemaField{
					{Name: "street", Path: "address.street", Type: "string", Required: false, Description: "Street address"},
					{Name: "city", Path: "address.city", Type: "string", Required: false, Description: "City"},
					{Name: "state", Path: "address.state", Type: "string", Required: false, Description: "State/Province"},
					{Name: "postalCode", Path: "address.postalCode", Type: "string", Required: false, Description: "Postal/ZIP code"},
					{Name: "country", Path: "address.country", Type: "string", Required: false, Description: "Country"},
				}},
				{Name: "createdAt", Path: "createdAt", Type: "string", Required: false, Description: "Creation timestamp", Format: "date-time"},
				{Name: "updatedAt", Path: "updatedAt", Type: "string", Required: false, Description: "Last update timestamp", Format: "date-time"},
			},
			JSONSchema: map[string]any{
				"$schema": "http://json-schema.org/draft-07/schema#",
				"type":    "object",
				"properties": map[string]any{
					"id":        map[string]any{"type": "string"},
					"email":     map[string]any{"type": "string", "format": "email"},
					"firstName": map[string]any{"type": "string"},
					"lastName":  map[string]any{"type": "string"},
					"phone":     map[string]any{"type": "string"},
					"address": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"street":     map[string]any{"type": "string"},
							"city":       map[string]any{"type": "string"},
							"state":      map[string]any{"type": "string"},
							"postalCode": map[string]any{"type": "string"},
							"country":    map[string]any{"type": "string"},
						},
					},
					"createdAt": map[string]any{"type": "string", "format": "date-time"},
					"updatedAt": map[string]any{"type": "string", "format": "date-time"},
				},
				"required": []string{"id", "email", "firstName", "lastName"},
			},
		},
		{
			Name:        "Standard Order",
			Description: "Standard e-commerce order schema",
			Version:     "1.0.0",
			Type:        SchemaTypePredefined,
			Category:    "e-commerce",
			Fields: []SchemaField{
				{Name: "id", Path: "id", Type: "string", Required: true, Description: "Order ID"},
				{Name: "orderNumber", Path: "orderNumber", Type: "string", Required: true, Description: "Human-readable order number"},
				{Name: "customerId", Path: "customerId", Type: "string", Required: true, Description: "Customer ID"},
				{Name: "status", Path: "status", Type: "string", Required: true, Description: "Order status", Enum: []any{"pending", "processing", "shipped", "delivered", "cancelled"}},
				{Name: "items", Path: "items", Type: "array", Required: true, Description: "Order line items"},
				{Name: "subtotal", Path: "subtotal", Type: "number", Required: true, Description: "Subtotal amount"},
				{Name: "tax", Path: "tax", Type: "number", Required: false, Description: "Tax amount"},
				{Name: "shipping", Path: "shipping", Type: "number", Required: false, Description: "Shipping cost"},
				{Name: "total", Path: "total", Type: "number", Required: true, Description: "Total amount"},
				{Name: "currency", Path: "currency", Type: "string", Required: true, Description: "Currency code"},
				{Name: "shippingAddress", Path: "shippingAddress", Type: "object", Required: false, Description: "Shipping address"},
				{Name: "billingAddress", Path: "billingAddress", Type: "object", Required: false, Description: "Billing address"},
				{Name: "createdAt", Path: "createdAt", Type: "string", Required: true, Description: "Order creation time", Format: "date-time"},
			},
			JSONSchema: map[string]any{
				"$schema": "http://json-schema.org/draft-07/schema#",
				"type":    "object",
				"properties": map[string]any{
					"id":          map[string]any{"type": "string"},
					"orderNumber": map[string]any{"type": "string"},
					"customerId":  map[string]any{"type": "string"},
					"status":      map[string]any{"type": "string", "enum": []string{"pending", "processing", "shipped", "delivered", "cancelled"}},
					"items":       map[string]any{"type": "array", "items": map[string]any{"type": "object"}},
					"subtotal":    map[string]any{"type": "number"},
					"tax":         map[string]any{"type": "number"},
					"shipping":    map[string]any{"type": "number"},
					"total":       map[string]any{"type": "number"},
					"currency":    map[string]any{"type": "string"},
					"createdAt":   map[string]any{"type": "string", "format": "date-time"},
				},
				"required": []string{"id", "orderNumber", "customerId", "status", "items", "subtotal", "total", "currency", "createdAt"},
			},
		},
		{
			Name:        "Standard Product",
			Description: "Standard product/item schema",
			Version:     "1.0.0",
			Type:        SchemaTypePredefined,
			Category:    "e-commerce",
			Fields: []SchemaField{
				{Name: "id", Path: "id", Type: "string", Required: true, Description: "Product ID"},
				{Name: "sku", Path: "sku", Type: "string", Required: true, Description: "Stock Keeping Unit"},
				{Name: "name", Path: "name", Type: "string", Required: true, Description: "Product name"},
				{Name: "description", Path: "description", Type: "string", Required: false, Description: "Product description"},
				{Name: "price", Path: "price", Type: "number", Required: true, Description: "Product price"},
				{Name: "currency", Path: "currency", Type: "string", Required: true, Description: "Currency code"},
				{Name: "category", Path: "category", Type: "string", Required: false, Description: "Product category"},
				{Name: "brand", Path: "brand", Type: "string", Required: false, Description: "Brand name"},
				{Name: "stock", Path: "stock", Type: "number", Required: false, Description: "Stock quantity"},
				{Name: "images", Path: "images", Type: "array", Required: false, Description: "Product images"},
				{Name: "attributes", Path: "attributes", Type: "object", Required: false, Description: "Custom attributes"},
				{Name: "active", Path: "active", Type: "boolean", Required: true, Description: "Is product active"},
			},
			JSONSchema: map[string]any{
				"$schema": "http://json-schema.org/draft-07/schema#",
				"type":    "object",
				"properties": map[string]any{
					"id":          map[string]any{"type": "string"},
					"sku":         map[string]any{"type": "string"},
					"name":        map[string]any{"type": "string"},
					"description": map[string]any{"type": "string"},
					"price":       map[string]any{"type": "number"},
					"currency":    map[string]any{"type": "string"},
					"category":    map[string]any{"type": "string"},
					"brand":       map[string]any{"type": "string"},
					"stock":       map[string]any{"type": "number"},
					"images":      map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
					"attributes":  map[string]any{"type": "object"},
					"active":      map[string]any{"type": "boolean"},
				},
				"required": []string{"id", "sku", "name", "price", "currency", "active"},
			},
		},
		{
			Name:        "Standard Contact",
			Description: "Standard CRM contact schema",
			Version:     "1.0.0",
			Type:        SchemaTypePredefined,
			Category:    "crm",
			Fields: []SchemaField{
				{Name: "id", Path: "id", Type: "string", Required: true, Description: "Contact ID"},
				{Name: "email", Path: "email", Type: "string", Required: true, Description: "Email address", Format: "email"},
				{Name: "firstName", Path: "firstName", Type: "string", Required: true, Description: "First name"},
				{Name: "lastName", Path: "lastName", Type: "string", Required: true, Description: "Last name"},
				{Name: "company", Path: "company", Type: "string", Required: false, Description: "Company name"},
				{Name: "jobTitle", Path: "jobTitle", Type: "string", Required: false, Description: "Job title"},
				{Name: "phone", Path: "phone", Type: "string", Required: false, Description: "Phone number"},
				{Name: "mobile", Path: "mobile", Type: "string", Required: false, Description: "Mobile number"},
				{Name: "source", Path: "source", Type: "string", Required: false, Description: "Lead source"},
				{Name: "status", Path: "status", Type: "string", Required: false, Description: "Contact status"},
				{Name: "tags", Path: "tags", Type: "array", Required: false, Description: "Tags/Labels"},
				{Name: "notes", Path: "notes", Type: "string", Required: false, Description: "Notes"},
			},
			JSONSchema: map[string]any{
				"$schema": "http://json-schema.org/draft-07/schema#",
				"type":    "object",
				"properties": map[string]any{
					"id":        map[string]any{"type": "string"},
					"email":     map[string]any{"type": "string", "format": "email"},
					"firstName": map[string]any{"type": "string"},
					"lastName":  map[string]any{"type": "string"},
					"company":   map[string]any{"type": "string"},
					"jobTitle":  map[string]any{"type": "string"},
					"phone":     map[string]any{"type": "string"},
					"mobile":    map[string]any{"type": "string"},
					"source":    map[string]any{"type": "string"},
					"status":    map[string]any{"type": "string"},
					"tags":      map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
					"notes":     map[string]any{"type": "string"},
				},
				"required": []string{"id", "email", "firstName", "lastName"},
			},
		},
	}
}
