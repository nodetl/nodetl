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
	ErrRefreshTokenNotFound = errors.New("refresh token not found")
	ErrRefreshTokenRevoked  = errors.New("refresh token has been revoked")
	ErrRefreshTokenExpired  = errors.New("refresh token has expired")
)

// RefreshTokenRepository defines the interface for refresh token operations
type RefreshTokenRepository interface {
	Create(ctx context.Context, token *domain.RefreshToken) error
	GetByToken(ctx context.Context, tokenHash string) (*domain.RefreshToken, error)
	GetByUserID(ctx context.Context, userID primitive.ObjectID) ([]domain.RefreshToken, error)
	Revoke(ctx context.Context, id primitive.ObjectID) error
	RevokeAllByUserID(ctx context.Context, userID primitive.ObjectID) error
	DeleteExpired(ctx context.Context) error
}

type refreshTokenRepository struct {
	collection *mongo.Collection
}

// NewRefreshTokenRepository creates a new refresh token repository
func NewRefreshTokenRepository(client *mongodb.Client) RefreshTokenRepository {
	collection := client.Collection(mongodb.CollectionRefreshTokens)

	// Create indexes
	ctx := context.Background()
	indexes := []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "user_id", Value: 1}},
		},
		{
			Keys:    bson.D{{Key: "expires_at", Value: 1}},
			Options: options.Index().SetExpireAfterSeconds(0), // TTL index
		},
	}
	_, _ = collection.Indexes().CreateMany(ctx, indexes)

	return &refreshTokenRepository{collection: collection}
}

func (r *refreshTokenRepository) Create(ctx context.Context, token *domain.RefreshToken) error {
	token.CreatedAt = time.Now()

	result, err := r.collection.InsertOne(ctx, token)
	if err != nil {
		return err
	}

	token.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (r *refreshTokenRepository) GetByToken(ctx context.Context, tokenHash string) (*domain.RefreshToken, error) {
	var token domain.RefreshToken

	err := r.collection.FindOne(ctx, bson.M{
		"token":      tokenHash,
		"revoked_at": bson.M{"$eq": nil},
		"expires_at": bson.M{"$gt": time.Now()},
	}).Decode(&token)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrRefreshTokenNotFound
		}
		return nil, err
	}

	return &token, nil
}

func (r *refreshTokenRepository) GetByUserID(ctx context.Context, userID primitive.ObjectID) ([]domain.RefreshToken, error) {
	cursor, err := r.collection.Find(ctx, bson.M{
		"user_id":    userID,
		"revoked_at": bson.M{"$eq": nil},
		"expires_at": bson.M{"$gt": time.Now()},
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var tokens []domain.RefreshToken
	if err := cursor.All(ctx, &tokens); err != nil {
		return nil, err
	}

	return tokens, nil
}

func (r *refreshTokenRepository) Revoke(ctx context.Context, id primitive.ObjectID) error {
	now := time.Now()
	result, err := r.collection.UpdateOne(ctx,
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"revoked_at": now}},
	)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return ErrRefreshTokenNotFound
	}

	return nil
}

func (r *refreshTokenRepository) RevokeAllByUserID(ctx context.Context, userID primitive.ObjectID) error {
	now := time.Now()
	_, err := r.collection.UpdateMany(ctx,
		bson.M{
			"user_id":    userID,
			"revoked_at": bson.M{"$eq": nil},
		},
		bson.M{"$set": bson.M{"revoked_at": now}},
	)
	return err
}

func (r *refreshTokenRepository) DeleteExpired(ctx context.Context) error {
	_, err := r.collection.DeleteMany(ctx, bson.M{
		"expires_at": bson.M{"$lt": time.Now()},
	})
	return err
}
