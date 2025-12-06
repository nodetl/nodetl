package repository

import (
	"context"
	"time"

	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/pkg/mongodb"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type NodeSchemaRepository interface {
	Upsert(ctx context.Context, nodeSchema *domain.NodeSchema) error
	GetByNode(ctx context.Context, workflowID, nodeID string) (*domain.NodeSchema, error)
	DeleteByNode(ctx context.Context, workflowID, nodeID string) error
	DeleteByWorkflow(ctx context.Context, workflowID string) error
	ListByWorkflow(ctx context.Context, workflowID string) ([]*domain.NodeSchema, error)
}

type nodeSchemaRepository struct {
	collection *mongo.Collection
}

func NewNodeSchemaRepository(client *mongodb.Client) NodeSchemaRepository {
	return &nodeSchemaRepository{
		collection: client.Collection("node_schemas"),
	}
}

func (r *nodeSchemaRepository) Upsert(ctx context.Context, nodeSchema *domain.NodeSchema) error {
	now := time.Now()
	nodeSchema.UpdatedAt = now
	
	filter := bson.M{
		"workflow_id": nodeSchema.WorkflowID,
		"node_id":     nodeSchema.NodeID,
	}
	
	// Check if exists
	var existing domain.NodeSchema
	err := r.collection.FindOne(ctx, filter).Decode(&existing)
	
	if err == mongo.ErrNoDocuments {
		// Insert new
		nodeSchema.ID = primitive.NewObjectID()
		nodeSchema.CreatedAt = now
		_, err = r.collection.InsertOne(ctx, nodeSchema)
		return err
	} else if err != nil {
		return err
	}
	
	// Update existing
	update := bson.M{
		"$set": bson.M{
			"source_schema": nodeSchema.SourceSchema,
			"target_schema": nodeSchema.TargetSchema,
			"connections":   nodeSchema.Connections,
			"header_fields": nodeSchema.HeaderFields,
			"updated_at":    now,
		},
	}
	
	_, err = r.collection.UpdateOne(ctx, filter, update)
	return err
}

func (r *nodeSchemaRepository) GetByNode(ctx context.Context, workflowID, nodeID string) (*domain.NodeSchema, error) {
	filter := bson.M{
		"workflow_id": workflowID,
		"node_id":     nodeID,
	}
	
	var nodeSchema domain.NodeSchema
	err := r.collection.FindOne(ctx, filter).Decode(&nodeSchema)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	
	return &nodeSchema, nil
}

func (r *nodeSchemaRepository) DeleteByNode(ctx context.Context, workflowID, nodeID string) error {
	filter := bson.M{
		"workflow_id": workflowID,
		"node_id":     nodeID,
	}
	
	_, err := r.collection.DeleteOne(ctx, filter)
	return err
}

func (r *nodeSchemaRepository) DeleteByWorkflow(ctx context.Context, workflowID string) error {
	filter := bson.M{
		"workflow_id": workflowID,
	}
	
	_, err := r.collection.DeleteMany(ctx, filter)
	return err
}

func (r *nodeSchemaRepository) ListByWorkflow(ctx context.Context, workflowID string) ([]*domain.NodeSchema, error) {
	filter := bson.M{
		"workflow_id": workflowID,
	}
	
	opts := options.Find().SetSort(bson.M{"created_at": -1})
	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	
	var nodeSchemas []*domain.NodeSchema
	if err := cursor.All(ctx, &nodeSchemas); err != nil {
		return nil, err
	}
	
	return nodeSchemas, nil
}
