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

type executionRepository struct {
	collection *mongo.Collection
}

func NewExecutionRepository(client *mongodb.Client) ExecutionRepository {
	return &executionRepository{
		collection: client.Collection(mongodb.CollectionExecutions),
	}
}

func (r *executionRepository) Create(ctx context.Context, execution *domain.Execution) error {
	execution.StartedAt = time.Now()

	result, err := r.collection.InsertOne(ctx, execution)
	if err != nil {
		return err
	}

	execution.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (r *executionRepository) GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Execution, error) {
	var execution domain.Execution
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&execution)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &execution, nil
}

func (r *executionRepository) GetByWorkflowID(ctx context.Context, workflowID primitive.ObjectID, page, pageSize int) ([]domain.Execution, int64, error) {
	query := bson.M{"workflow_id": workflowID}

	total, err := r.collection.CountDocuments(ctx, query)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "started_at", Value: -1}})

	if pageSize > 0 {
		opts.SetLimit(int64(pageSize))
		opts.SetSkip(int64((page - 1) * pageSize))
	}

	cursor, err := r.collection.Find(ctx, query, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var executions []domain.Execution
	if err := cursor.All(ctx, &executions); err != nil {
		return nil, 0, err
	}

	return executions, total, nil
}

func (r *executionRepository) GetByWorkflowIDs(ctx context.Context, workflowIDs []primitive.ObjectID, page, pageSize int) ([]domain.Execution, int64, error) {
	if len(workflowIDs) == 0 {
		return []domain.Execution{}, 0, nil
	}

	query := bson.M{"workflow_id": bson.M{"$in": workflowIDs}}

	total, err := r.collection.CountDocuments(ctx, query)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "started_at", Value: -1}})

	if pageSize > 0 {
		opts.SetLimit(int64(pageSize))
		opts.SetSkip(int64((page - 1) * pageSize))
	}

	cursor, err := r.collection.Find(ctx, query, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var executions []domain.Execution
	if err := cursor.All(ctx, &executions); err != nil {
		return nil, 0, err
	}

	return executions, total, nil
}

func (r *executionRepository) Update(ctx context.Context, execution *domain.Execution) error {
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": execution.ID}, execution)
	return err
}

func (r *executionRepository) Delete(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *executionRepository) GetLatest(ctx context.Context, workflowID primitive.ObjectID, limit int) ([]domain.Execution, error) {
	opts := options.Find().
		SetSort(bson.D{{Key: "started_at", Value: -1}}).
		SetLimit(int64(limit))

	cursor, err := r.collection.Find(ctx, bson.M{"workflow_id": workflowID}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var executions []domain.Execution
	if err := cursor.All(ctx, &executions); err != nil {
		return nil, err
	}

	return executions, nil
}
