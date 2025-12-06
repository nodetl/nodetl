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

type schemaRepository struct {
	collection *mongo.Collection
}

func NewSchemaRepository(client *mongodb.Client) SchemaRepository {
	return &schemaRepository{
		collection: client.Collection(mongodb.CollectionSchemas),
	}
}

func (r *schemaRepository) Create(ctx context.Context, schema *domain.Schema) error {
	schema.CreatedAt = time.Now()
	schema.UpdatedAt = time.Now()
	
	result, err := r.collection.InsertOne(ctx, schema)
	if err != nil {
		return err
	}
	
	schema.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (r *schemaRepository) GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Schema, error) {
	var schema domain.Schema
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&schema)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &schema, nil
}

func (r *schemaRepository) GetAll(ctx context.Context, filter SchemaFilter) ([]domain.Schema, int64, error) {
	query := bson.M{}
	
	if filter.Type != nil {
		query["type"] = *filter.Type
	}
	if filter.Category != nil && *filter.Category != "" {
		query["category"] = *filter.Category
	}
	if filter.Name != nil && *filter.Name != "" {
		query["name"] = bson.M{"$regex": *filter.Name, "$options": "i"}
	}
	
	total, err := r.collection.CountDocuments(ctx, query)
	if err != nil {
		return nil, 0, err
	}
	
	opts := options.Find().SetSort(bson.D{{Key: "name", Value: 1}})
	
	if filter.PageSize > 0 {
		opts.SetLimit(int64(filter.PageSize))
		opts.SetSkip(int64((filter.Page - 1) * filter.PageSize))
	}
	
	cursor, err := r.collection.Find(ctx, query, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)
	
	var schemas []domain.Schema
	if err := cursor.All(ctx, &schemas); err != nil {
		return nil, 0, err
	}
	
	return schemas, total, nil
}

func (r *schemaRepository) Update(ctx context.Context, schema *domain.Schema) error {
	schema.UpdatedAt = time.Now()
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": schema.ID}, schema)
	return err
}

func (r *schemaRepository) Delete(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *schemaRepository) GetByName(ctx context.Context, name string) (*domain.Schema, error) {
	var schema domain.Schema
	err := r.collection.FindOne(ctx, bson.M{"name": name}).Decode(&schema)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &schema, nil
}

func (r *schemaRepository) SeedPredefined(ctx context.Context) error {
	predefined := domain.GetPredefinedSchemas()
	
	for _, schema := range predefined {
		existing, err := r.GetByName(ctx, schema.Name)
		if err != nil {
			return err
		}
		
		if existing == nil {
			schema.CreatedAt = time.Now()
			schema.UpdatedAt = time.Now()
			schema.CreatedBy = "system"
			if _, err := r.collection.InsertOne(ctx, schema); err != nil {
				return err
			}
		}
	}
	
	return nil
}
