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

type workflowRepository struct {
	collection *mongo.Collection
}

func NewWorkflowRepository(client *mongodb.Client) WorkflowRepository {
	return &workflowRepository{
		collection: client.Collection(mongodb.CollectionWorkflows),
	}
}

func (r *workflowRepository) Create(ctx context.Context, workflow *domain.Workflow) error {
	workflow.CreatedAt = time.Now()
	workflow.UpdatedAt = time.Now()
	if workflow.Version == 0 {
		workflow.Version = 1
	}

	result, err := r.collection.InsertOne(ctx, workflow)
	if err != nil {
		return err
	}

	workflow.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (r *workflowRepository) GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Workflow, error) {
	var workflow domain.Workflow
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&workflow)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &workflow, nil
}

func (r *workflowRepository) GetAll(ctx context.Context, filter WorkflowFilter) ([]domain.Workflow, int64, error) {
	query := bson.M{}

	if filter.Status != nil {
		query["status"] = *filter.Status
	}
	if filter.Name != nil && *filter.Name != "" {
		query["name"] = bson.M{"$regex": *filter.Name, "$options": "i"}
	}

	// Count total
	total, err := r.collection.CountDocuments(ctx, query)
	if err != nil {
		return nil, 0, err
	}

	// Pagination
	opts := options.Find().
		SetSort(bson.D{{Key: "updated_at", Value: -1}})

	if filter.PageSize > 0 {
		opts.SetLimit(int64(filter.PageSize))
		opts.SetSkip(int64((filter.Page - 1) * filter.PageSize))
	}

	cursor, err := r.collection.Find(ctx, query, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var workflows []domain.Workflow
	if err := cursor.All(ctx, &workflows); err != nil {
		return nil, 0, err
	}

	return workflows, total, nil
}

func (r *workflowRepository) Update(ctx context.Context, workflow *domain.Workflow) error {
	workflow.UpdatedAt = time.Now()
	workflow.Version++

	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": workflow.ID}, workflow)
	return err
}

// PartialUpdate updates only specific fields (optimized for auto-save)
func (r *workflowRepository) PartialUpdate(ctx context.Context, id primitive.ObjectID, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now()

	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{"_id": id},
		bson.M{
			"$set": updates,
			"$inc": bson.M{"version": 1},
		},
	)
	return err
}

func (r *workflowRepository) Delete(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *workflowRepository) GetByEndpointPath(ctx context.Context, path string) (*domain.Workflow, error) {
	// First try to find by endpoint.path (legacy)
	var workflow domain.Workflow
	err := r.collection.FindOne(ctx, bson.M{
		"endpoint.path": path,
		"status":        domain.WorkflowStatusActive,
	}).Decode(&workflow)

	if err == nil {
		return &workflow, nil
	}

	if err != mongo.ErrNoDocuments {
		return nil, err
	}

	// Try to find by trigger node's webhookPath
	// This supports multiple trigger nodes in a single workflow
	err = r.collection.FindOne(ctx, bson.M{
		"nodes": bson.M{
			"$elemMatch": bson.M{
				"type":              "trigger",
				"data.webhook_path": path,
			},
		},
		"status": domain.WorkflowStatusActive,
	}).Decode(&workflow)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &workflow, nil
}

// CheckEndpointExists checks if an endpoint path already exists in any workflow
func (r *workflowRepository) CheckEndpointExists(ctx context.Context, path string, excludeWorkflowID *primitive.ObjectID) (bool, error) {
	query := bson.M{
		"nodes": bson.M{
			"$elemMatch": bson.M{
				"type":              "trigger",
				"data.webhook_path": path,
			},
		},
	}

	// Exclude specific workflow (for updates)
	if excludeWorkflowID != nil {
		query["_id"] = bson.M{"$ne": *excludeWorkflowID}
	}

	count, err := r.collection.CountDocuments(ctx, query)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}
