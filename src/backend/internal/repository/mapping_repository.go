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

type mappingRepository struct {
	collection *mongo.Collection
}

func NewMappingRepository(client *mongodb.Client) MappingRepository {
	return &mappingRepository{
		collection: client.Collection(mongodb.CollectionMappings),
	}
}

func (r *mappingRepository) Create(ctx context.Context, mapping *domain.FieldMapping) error {
	mapping.CreatedAt = time.Now()
	mapping.UpdatedAt = time.Now()
	
	result, err := r.collection.InsertOne(ctx, mapping)
	if err != nil {
		return err
	}
	
	mapping.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (r *mappingRepository) GetByID(ctx context.Context, id primitive.ObjectID) (*domain.FieldMapping, error) {
	var mapping domain.FieldMapping
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&mapping)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &mapping, nil
}

func (r *mappingRepository) GetBySchemas(ctx context.Context, sourceID, targetID primitive.ObjectID) (*domain.FieldMapping, error) {
	var mapping domain.FieldMapping
	err := r.collection.FindOne(ctx, bson.M{
		"source_schema_id": sourceID,
		"target_schema_id": targetID,
	}).Decode(&mapping)
	
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &mapping, nil
}

func (r *mappingRepository) GetAll(ctx context.Context, page, pageSize int) ([]domain.FieldMapping, int64, error) {
	total, err := r.collection.CountDocuments(ctx, bson.M{})
	if err != nil {
		return nil, 0, err
	}
	
	opts := options.Find().
		SetSort(bson.D{{Key: "updated_at", Value: -1}})
	
	if pageSize > 0 {
		opts.SetLimit(int64(pageSize))
		opts.SetSkip(int64((page - 1) * pageSize))
	}
	
	cursor, err := r.collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)
	
	var mappings []domain.FieldMapping
	if err := cursor.All(ctx, &mappings); err != nil {
		return nil, 0, err
	}
	
	return mappings, total, nil
}

func (r *mappingRepository) Update(ctx context.Context, mapping *domain.FieldMapping) error {
	mapping.UpdatedAt = time.Now()
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": mapping.ID}, mapping)
	return err
}

func (r *mappingRepository) Delete(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	return err
}
