package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AppSettings represents the application settings stored in the database
type AppSettings struct {
	ID             primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	ProjectName    string             `json:"projectName" bson:"project_name"`
	LogoURL        string             `json:"logoUrl" bson:"logo_url"`
	FaviconURL     string             `json:"faviconUrl,omitempty" bson:"favicon_url,omitempty"`
	PrimaryColor   string             `json:"primaryColor" bson:"primary_color"`
	SecondaryColor string             `json:"secondaryColor" bson:"secondary_color"`
	UpdatedAt      time.Time          `json:"updatedAt" bson:"updated_at"`
	UpdatedBy      primitive.ObjectID `json:"updatedBy,omitempty" bson:"updated_by,omitempty"`
}

// PublicSettings represents settings exposed to unauthenticated users
type PublicSettings struct {
	ProjectName    string `json:"projectName"`
	LogoURL        string `json:"logoUrl"`
	FaviconURL     string `json:"faviconUrl,omitempty"`
	PrimaryColor   string `json:"primaryColor"`
	SecondaryColor string `json:"secondaryColor"`
}

// ToPublic converts AppSettings to PublicSettings
func (s *AppSettings) ToPublic() PublicSettings {
	return PublicSettings{
		ProjectName:    s.ProjectName,
		LogoURL:        s.LogoURL,
		FaviconURL:     s.FaviconURL,
		PrimaryColor:   s.PrimaryColor,
		SecondaryColor: s.SecondaryColor,
	}
}

// UpdateSettingsRequest represents a request to update app settings
type UpdateSettingsRequest struct {
	ProjectName    *string `json:"projectName,omitempty"`
	LogoURL        *string `json:"logoUrl,omitempty"`
	FaviconURL     *string `json:"faviconUrl,omitempty"`
	PrimaryColor   *string `json:"primaryColor,omitempty"`
	SecondaryColor *string `json:"secondaryColor,omitempty"`
}

// DefaultSettings returns the default application settings
func DefaultSettings() AppSettings {
	return AppSettings{
		ProjectName:    "NodeTL",
		LogoURL:        "/logo.svg",
		FaviconURL:     "/logo.png",
		PrimaryColor:   "#0ea5e9",
		SecondaryColor: "#6366f1",
		UpdatedAt:      time.Now(),
	}
}
