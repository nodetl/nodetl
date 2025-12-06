package config

import (
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Server   ServerConfig
	MongoDB  MongoDBConfig
	AI       AIConfig
	Auth     AuthConfig
	SMTP     SMTPConfig
	App      AppConfig
	Logging  LoggingConfig
}

type ServerConfig struct {
	Port string
	Mode string
}

type MongoDBConfig struct {
	URI      string
	Database string
}

type AIConfig struct {
	Provider    string
	OpenAIKey   string
	OpenAIModel string
}

// AuthConfig contains authentication settings
type AuthConfig struct {
	// JWT Settings
	AccessTokenSecret   string
	AccessTokenExpiry   time.Duration
	RefreshTokenSecret  string
	RefreshTokenExpiry  time.Duration

	// Admin auto-creation
	AutoCreateAdmin bool

	// Google OAuth
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	// Microsoft OAuth
	MicrosoftClientID     string
	MicrosoftClientSecret string
	MicrosoftTenantID     string
	MicrosoftRedirectURL  string
}

// SMTPConfig contains email settings
type SMTPConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
	FromName string
	UseTLS   bool
}

// AppConfig contains application branding settings
type AppConfig struct {
	Name           string
	Domain         string
	LogoPath       string
	PrimaryColor   string
	SecondaryColor string
}

type LoggingConfig struct {
	Level  string
	Format string
}

func Load() (*Config, error) {
	// Load .env file if exists
	_ = godotenv.Load()

	// Parse access token expiry
	accessTokenExpiry, err := time.ParseDuration(getEnv("AUTH_ACCESS_TOKEN_EXPIRY", "15m"))
	if err != nil {
		accessTokenExpiry = 15 * time.Minute
	}

	// Parse refresh token expiry
	refreshTokenExpiry, err := time.ParseDuration(getEnv("AUTH_REFRESH_TOKEN_EXPIRY", "7d"))
	if err != nil {
		refreshTokenExpiry = 7 * 24 * time.Hour
	}

	return &Config{
		Server: ServerConfig{
			Port: getEnv("SERVER_PORT", "8080"),
			Mode: getEnv("SERVER_MODE", "debug"),
		},
		MongoDB: MongoDBConfig{
			URI:      getEnv("MONGODB_URI", "mongodb://localhost:27017"),
			Database: getEnv("MONGODB_DATABASE", "nodetl"),
		},
		AI: AIConfig{
			Provider:    getEnv("AI_PROVIDER", "openai"),
			OpenAIKey:   getEnv("OPENAI_API_KEY", ""),
			OpenAIModel: getEnv("OPENAI_MODEL", "gpt-4"),
		},
		Auth: AuthConfig{
			AccessTokenSecret:     getEnv("AUTH_ACCESS_TOKEN_SECRET", "change-me-access-secret"),
			AccessTokenExpiry:     accessTokenExpiry,
			RefreshTokenSecret:    getEnv("AUTH_REFRESH_TOKEN_SECRET", "change-me-refresh-secret"),
			RefreshTokenExpiry:    refreshTokenExpiry,
			AutoCreateAdmin:       getEnv("AUTH_AUTO_CREATE_ADMIN", "true") == "true",
			GoogleClientID:        getEnv("OAUTH_GOOGLE_CLIENT_ID", ""),
			GoogleClientSecret:    getEnv("OAUTH_GOOGLE_CLIENT_SECRET", ""),
			GoogleRedirectURL:     getEnv("OAUTH_GOOGLE_REDIRECT_URL", ""),
			MicrosoftClientID:     getEnv("OAUTH_MICROSOFT_CLIENT_ID", ""),
			MicrosoftClientSecret: getEnv("OAUTH_MICROSOFT_CLIENT_SECRET", ""),
			MicrosoftTenantID:     getEnv("OAUTH_MICROSOFT_TENANT_ID", "common"),
			MicrosoftRedirectURL:  getEnv("OAUTH_MICROSOFT_REDIRECT_URL", ""),
		},
		SMTP: SMTPConfig{
			Host:     getEnv("SMTP_HOST", ""),
			Port:     getEnv("SMTP_PORT", "587"),
			Username: getEnv("SMTP_USERNAME", ""),
			Password: getEnv("SMTP_PASSWORD", ""),
			From:     getEnv("SMTP_FROM", ""),
			FromName: getEnv("SMTP_FROM_NAME", "NodeTL"),
			UseTLS:   getEnv("SMTP_USE_TLS", "true") == "true",
		},
		App: AppConfig{
			Name:           getEnv("APP_NAME", "NodeTL"),
			Domain:         getEnv("APP_DOMAIN", "http://localhost:3000"),
			LogoPath:       getEnv("APP_LOGO_PATH", "/logo.svg"),
			PrimaryColor:   getEnv("APP_PRIMARY_COLOR", "#0ea5e9"),
			SecondaryColor: getEnv("APP_SECONDARY_COLOR", "#6366f1"),
		},
		Logging: LoggingConfig{
			Level:  getEnv("LOG_LEVEL", "debug"),
			Format: getEnv("LOG_FORMAT", "json"),
		},
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
