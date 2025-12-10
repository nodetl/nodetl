package repository

import (
	"context"
	"errors"
	"time"

	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/pkg/mongodb"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	ErrRoleNotFound      = errors.New("role not found")
	ErrRoleAlreadyExists = errors.New("role with this name already exists")
	ErrRoleIsSystem      = errors.New("system roles cannot be modified")
)

// RoleRepository defines the interface for role data operations
type RoleRepository interface {
	Create(ctx context.Context, role *domain.Role) error
	GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Role, error)
	GetByName(ctx context.Context, name string) (*domain.Role, error)
	GetAll(ctx context.Context) ([]domain.Role, error)
	Update(ctx context.Context, role *domain.Role) error
	Delete(ctx context.Context, id primitive.ObjectID) error
	SeedDefaults(ctx context.Context) error
	GetAdminRole(ctx context.Context) (*domain.Role, error)
}

type roleRepository struct {
	collection *mongo.Collection
}

// NewRoleRepository creates a new role repository
func NewRoleRepository(client *mongodb.Client) RoleRepository {
	collection := client.Collection(mongodb.CollectionRoles)

	// Create indexes
	ctx := context.Background()
	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "name", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
	}
	_, _ = collection.Indexes().CreateMany(ctx, indexes)

	return &roleRepository{collection: collection}
}

func (r *roleRepository) Create(ctx context.Context, role *domain.Role) error {
	// Check if name already exists
	existing, _ := r.GetByName(ctx, role.Name)
	if existing != nil {
		return ErrRoleAlreadyExists
	}

	now := time.Now()
	role.CreatedAt = now
	role.UpdatedAt = now

	result, err := r.collection.InsertOne(ctx, role)
	if err != nil {
		return err
	}

	role.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (r *roleRepository) GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Role, error) {
	var role domain.Role
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&role)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrRoleNotFound
		}
		return nil, err
	}
	return &role, nil
}

func (r *roleRepository) GetByName(ctx context.Context, name string) (*domain.Role, error) {
	var role domain.Role
	err := r.collection.FindOne(ctx, bson.M{"name": name}).Decode(&role)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrRoleNotFound
		}
		return nil, err
	}
	return &role, nil
}

func (r *roleRepository) GetAll(ctx context.Context) ([]domain.Role, error) {
	cursor, err := r.collection.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "name", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var roles []domain.Role
	if err := cursor.All(ctx, &roles); err != nil {
		return nil, err
	}

	return roles, nil
}

func (r *roleRepository) Update(ctx context.Context, role *domain.Role) error {
	// Check if it's a system role
	existing, err := r.GetByID(ctx, role.ID)
	if err != nil {
		return err
	}

	// System roles can have permissions updated but not name/isSystem
	if existing.IsSystem {
		role.Name = existing.Name
		role.IsSystem = true
	}

	role.UpdatedAt = time.Now()

	result, err := r.collection.ReplaceOne(ctx, bson.M{"_id": role.ID}, role)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return ErrRoleNotFound
	}

	return nil
}

func (r *roleRepository) Delete(ctx context.Context, id primitive.ObjectID) error {
	// Check if it's a system role
	role, err := r.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if role.IsSystem {
		return ErrRoleIsSystem
	}

	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}

	if result.DeletedCount == 0 {
		return ErrRoleNotFound
	}

	return nil
}

func (r *roleRepository) SeedDefaults(ctx context.Context) error {
	defaultRoles := domain.DefaultRoles()

	for _, role := range defaultRoles {
		existing, _ := r.GetByName(ctx, role.Name)
		if existing == nil {
			if err := r.Create(ctx, &role); err != nil {
				return err
			}
		} else if existing.IsSystem {
			// Update system roles to ensure they have the latest permissions
			existing.Permissions = role.Permissions
			if err := r.Update(ctx, existing); err != nil {
				return err
			}
		}
	}

	return nil
}

func (r *roleRepository) GetAdminRole(ctx context.Context) (*domain.Role, error) {
	return r.GetByName(ctx, "Admin")
}
