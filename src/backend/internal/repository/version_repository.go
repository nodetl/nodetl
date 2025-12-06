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

type VersionRepository struct {
	collection *mongo.Collection
}

func NewVersionRepository(client *mongodb.Client) *VersionRepository {
	return &VersionRepository{
		collection: client.Collection("versions"),
	}
}

// Create creates a new version
func (r *VersionRepository) Create(ctx context.Context, version *domain.Version) error {
	version.CreatedAt = time.Now()
	version.UpdatedAt = time.Now()

	result, err := r.collection.InsertOne(ctx, version)
	if err != nil {
		return err
	}

	version.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetByID retrieves a version by ID
func (r *VersionRepository) GetByID(ctx context.Context, id string) (*domain.Version, error) {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	var version domain.Version
	err = r.collection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&version)
	if err != nil {
		return nil, err
	}

	return &version, nil
}

// GetByTag retrieves a version by tag
func (r *VersionRepository) GetByTag(ctx context.Context, tag string) (*domain.Version, error) {
	var version domain.Version
	err := r.collection.FindOne(ctx, bson.M{"tag": tag}).Decode(&version)
	if err != nil {
		return nil, err
	}

	return &version, nil
}

// List retrieves all versions
func (r *VersionRepository) List(ctx context.Context) ([]*domain.Version, error) {
	opts := options.Find().SetSort(bson.D{{Key: "tag", Value: -1}})

	cursor, err := r.collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var versions []*domain.Version
	if err := cursor.All(ctx, &versions); err != nil {
		return nil, err
	}

	return versions, nil
}

// Update updates an existing version
func (r *VersionRepository) Update(ctx context.Context, id string, version *domain.Version) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	version.UpdatedAt = time.Now()

	update := bson.M{
		"$set": bson.M{
			"tag":          version.Tag,
			"name":         version.Name,
			"description":  version.Description,
			"path_prefix":  version.PathPrefix,
			"headers":      version.Headers,
			"query_params": version.QueryParams,
			"is_default":   version.IsDefault,
			"updated_at":   version.UpdatedAt,
		},
	}

	_, err = r.collection.UpdateOne(ctx, bson.M{"_id": objectID}, update)
	return err
}

// Delete deletes a version by ID
func (r *VersionRepository) Delete(ctx context.Context, id string) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	_, err = r.collection.DeleteOne(ctx, bson.M{"_id": objectID})
	return err
}

// SetDefault sets a version as default and unsets others
func (r *VersionRepository) SetDefault(ctx context.Context, id string) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	// Unset all defaults
	_, err = r.collection.UpdateMany(ctx, bson.M{}, bson.M{"$set": bson.M{"is_default": false}})
	if err != nil {
		return err
	}

	// Set the specified version as default
	_, err = r.collection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": bson.M{"is_default": true}})
	return err
}

// GetDefault retrieves the default version
func (r *VersionRepository) GetDefault(ctx context.Context) (*domain.Version, error) {
	var version domain.Version
	err := r.collection.FindOne(ctx, bson.M{"is_default": true}).Decode(&version)
	if err != nil {
		return nil, err
	}

	return &version, nil
}
