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

type nodeTypeRepository struct {
	collection *mongo.Collection
}

func NewNodeTypeRepository(client *mongodb.Client) NodeTypeRepository {
	return &nodeTypeRepository{
		collection: client.Collection(mongodb.CollectionNodeTypes),
	}
}

func (r *nodeTypeRepository) Create(ctx context.Context, nodeType *domain.NodeType) error {
	nodeType.CreatedAt = time.Now()
	nodeType.UpdatedAt = time.Now()
	
	result, err := r.collection.InsertOne(ctx, nodeType)
	if err != nil {
		return err
	}
	
	nodeType.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (r *nodeTypeRepository) GetByID(ctx context.Context, id primitive.ObjectID) (*domain.NodeType, error) {
	var nodeType domain.NodeType
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&nodeType)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &nodeType, nil
}

func (r *nodeTypeRepository) GetByType(ctx context.Context, typeName string) (*domain.NodeType, error) {
	var nodeType domain.NodeType
	err := r.collection.FindOne(ctx, bson.M{"type": typeName}).Decode(&nodeType)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &nodeType, nil
}

func (r *nodeTypeRepository) GetAll(ctx context.Context, filter NodeTypeFilter) ([]domain.NodeType, error) {
	query := bson.M{}
	
	if filter.Category != nil && *filter.Category != "" {
		query["category"] = *filter.Category
	}
	if filter.IsBuiltIn != nil {
		query["is_built_in"] = *filter.IsBuiltIn
	}
	
	opts := options.Find().SetSort(bson.D{
		{Key: "category", Value: 1},
		{Key: "name", Value: 1},
	})
	
	cursor, err := r.collection.Find(ctx, query, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	
	var nodeTypes []domain.NodeType
	if err := cursor.All(ctx, &nodeTypes); err != nil {
		return nil, err
	}
	
	return nodeTypes, nil
}

func (r *nodeTypeRepository) Update(ctx context.Context, nodeType *domain.NodeType) error {
	nodeType.UpdatedAt = time.Now()
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": nodeType.ID}, nodeType)
	return err
}

func (r *nodeTypeRepository) Delete(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *nodeTypeRepository) SeedBuiltIn(ctx context.Context) error {
	builtIn := domain.GetBuiltInNodeTypes()
	
	for _, nodeType := range builtIn {
		existing, err := r.GetByType(ctx, nodeType.Type)
		if err != nil {
			return err
		}
		
		if existing == nil {
			nodeType.CreatedAt = time.Now()
			nodeType.UpdatedAt = time.Now()
			if _, err := r.collection.InsertOne(ctx, nodeType); err != nil {
				return err
			}
		}
	}
	
	return nil
}
