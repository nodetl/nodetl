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
)

var (
	ErrSettingsNotFound = errors.New("settings not found")
)

// SettingsRepository defines the interface for app settings operations
type SettingsRepository interface {
	Get(ctx context.Context) (*domain.AppSettings, error)
	Upsert(ctx context.Context, settings *domain.AppSettings) error
	SeedDefaults(ctx context.Context, appConfig *AppSettingsConfig) error
}

// AppSettingsConfig holds configuration from environment
type AppSettingsConfig struct {
	Name           string
	LogoPath       string
	PrimaryColor   string
	SecondaryColor string
}

type settingsRepository struct {
	collection *mongo.Collection
}

// NewSettingsRepository creates a new settings repository
func NewSettingsRepository(client *mongodb.Client) SettingsRepository {
	collection := client.Collection(mongodb.CollectionSettings)
	return &settingsRepository{collection: collection}
}

func (r *settingsRepository) Get(ctx context.Context) (*domain.AppSettings, error) {
	var settings domain.AppSettings
	err := r.collection.FindOne(ctx, bson.M{}).Decode(&settings)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrSettingsNotFound
		}
		return nil, err
	}
	return &settings, nil
}

func (r *settingsRepository) Upsert(ctx context.Context, settings *domain.AppSettings) error {
	settings.UpdatedAt = time.Now()

	if settings.ID.IsZero() {
		// Try to get existing settings
		existing, err := r.Get(ctx)
		if err != nil && !errors.Is(err, ErrSettingsNotFound) {
			return err
		}

		if existing != nil {
			settings.ID = existing.ID
		}
	}

	if settings.ID.IsZero() {
		// Create new
		result, err := r.collection.InsertOne(ctx, settings)
		if err != nil {
			return err
		}
		settings.ID = result.InsertedID.(primitive.ObjectID)
	} else {
		// Update existing
		_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": settings.ID}, settings)
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *settingsRepository) SeedDefaults(ctx context.Context, appConfig *AppSettingsConfig) error {
	existing, err := r.Get(ctx)
	if err != nil && !errors.Is(err, ErrSettingsNotFound) {
		return err
	}

	if existing != nil {
		// Settings already exist, don't overwrite
		return nil
	}

	// Create default settings from config
	settings := domain.DefaultSettings()
	
	if appConfig != nil {
		if appConfig.Name != "" {
			settings.ProjectName = appConfig.Name
		}
		if appConfig.LogoPath != "" {
			settings.LogoURL = appConfig.LogoPath
		}
		if appConfig.PrimaryColor != "" {
			settings.PrimaryColor = appConfig.PrimaryColor
		}
		if appConfig.SecondaryColor != "" {
			settings.SecondaryColor = appConfig.SecondaryColor
		}
	}

	return r.Upsert(ctx, &settings)
}
