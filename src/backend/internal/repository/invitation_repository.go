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
	ErrInvitationNotFound        = errors.New("invitation not found")
	ErrInvitationAlreadyExists   = errors.New("invitation for this email already exists")
	ErrInvitationExpired         = errors.New("invitation has expired")
	ErrInvitationAlreadyAccepted = errors.New("invitation has already been accepted")
)

// InvitationRepository defines the interface for invitation operations
type InvitationRepository interface {
	Create(ctx context.Context, invitation *domain.Invitation) error
	GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Invitation, error)
	GetByToken(ctx context.Context, tokenHash string) (*domain.Invitation, error)
	GetByEmail(ctx context.Context, email string) (*domain.Invitation, error)
	GetAll(ctx context.Context, filter InvitationFilter) ([]domain.Invitation, int64, error)
	Update(ctx context.Context, invitation *domain.Invitation) error
	Delete(ctx context.Context, id primitive.ObjectID) error
	MarkAccepted(ctx context.Context, id primitive.ObjectID) error
	MarkExpired(ctx context.Context) error
}

type InvitationFilter struct {
	Status   *domain.InvitationStatus
	Page     int
	PageSize int
}

type invitationRepository struct {
	collection *mongo.Collection
}

// NewInvitationRepository creates a new invitation repository
func NewInvitationRepository(client *mongodb.Client) InvitationRepository {
	collection := client.Collection(mongodb.CollectionInvitations)

	// Create indexes
	ctx := context.Background()
	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "email", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "token", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "status", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "expires_at", Value: 1}},
		},
	}
	_, _ = collection.Indexes().CreateMany(ctx, indexes)

	return &invitationRepository{collection: collection}
}

func (r *invitationRepository) Create(ctx context.Context, invitation *domain.Invitation) error {
	// Check if email already has a pending invitation
	existing, _ := r.GetByEmail(ctx, invitation.Email)
	if existing != nil && existing.Status == domain.InvitationStatusPending {
		return ErrInvitationAlreadyExists
	}

	// If there's an old non-pending invitation, delete it
	if existing != nil {
		_ = r.Delete(ctx, existing.ID)
	}

	invitation.CreatedAt = time.Now()
	invitation.Status = domain.InvitationStatusPending

	result, err := r.collection.InsertOne(ctx, invitation)
	if err != nil {
		return err
	}

	invitation.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (r *invitationRepository) GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Invitation, error) {
	var invitation domain.Invitation
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&invitation)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrInvitationNotFound
		}
		return nil, err
	}
	return &invitation, nil
}

func (r *invitationRepository) GetByToken(ctx context.Context, tokenHash string) (*domain.Invitation, error) {
	var invitation domain.Invitation
	err := r.collection.FindOne(ctx, bson.M{"token": tokenHash}).Decode(&invitation)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrInvitationNotFound
		}
		return nil, err
	}

	if invitation.Status != domain.InvitationStatusPending {
		if invitation.Status == domain.InvitationStatusAccepted {
			return nil, ErrInvitationAlreadyAccepted
		}
		return nil, ErrInvitationExpired
	}

	if time.Now().After(invitation.ExpiresAt) {
		return nil, ErrInvitationExpired
	}

	return &invitation, nil
}

func (r *invitationRepository) GetByEmail(ctx context.Context, email string) (*domain.Invitation, error) {
	var invitation domain.Invitation
	err := r.collection.FindOne(ctx, bson.M{"email": email}).Decode(&invitation)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrInvitationNotFound
		}
		return nil, err
	}
	return &invitation, nil
}

func (r *invitationRepository) GetAll(ctx context.Context, filter InvitationFilter) ([]domain.Invitation, int64, error) {
	query := bson.M{}

	if filter.Status != nil {
		query["status"] = *filter.Status
	}

	// Count total
	total, err := r.collection.CountDocuments(ctx, query)
	if err != nil {
		return nil, 0, err
	}

	// Apply pagination
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	if filter.PageSize > 0 {
		opts.SetLimit(int64(filter.PageSize))
		opts.SetSkip(int64((filter.Page - 1) * filter.PageSize))
	}

	cursor, err := r.collection.Find(ctx, query, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var invitations []domain.Invitation
	if err := cursor.All(ctx, &invitations); err != nil {
		return nil, 0, err
	}

	return invitations, total, nil
}

func (r *invitationRepository) Update(ctx context.Context, invitation *domain.Invitation) error {
	result, err := r.collection.ReplaceOne(ctx, bson.M{"_id": invitation.ID}, invitation)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return ErrInvitationNotFound
	}

	return nil
}

func (r *invitationRepository) Delete(ctx context.Context, id primitive.ObjectID) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}

	if result.DeletedCount == 0 {
		return ErrInvitationNotFound
	}

	return nil
}

func (r *invitationRepository) MarkAccepted(ctx context.Context, id primitive.ObjectID) error {
	now := time.Now()
	result, err := r.collection.UpdateOne(ctx,
		bson.M{"_id": id},
		bson.M{
			"$set": bson.M{
				"status":      domain.InvitationStatusAccepted,
				"accepted_at": now,
			},
		},
	)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return ErrInvitationNotFound
	}

	return nil
}

func (r *invitationRepository) MarkExpired(ctx context.Context) error {
	_, err := r.collection.UpdateMany(ctx,
		bson.M{
			"status":     domain.InvitationStatusPending,
			"expires_at": bson.M{"$lt": time.Now()},
		},
		bson.M{"$set": bson.M{"status": domain.InvitationStatusExpired}},
	)
	return err
}
