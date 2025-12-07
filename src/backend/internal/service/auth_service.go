package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nodetl/nodetl/config"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/repository"
	"github.com/nodetl/nodetl/pkg/auth"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrUserNotActive      = errors.New("user account is not active")
	ErrUserNotInvited     = errors.New("user has not been invited")
	ErrSSOUserNotFound    = errors.New("no account found for this SSO provider")
)

// AuthService handles authentication operations
type AuthService struct {
	userRepo         repository.UserRepository
	roleRepo         repository.RoleRepository
	refreshTokenRepo repository.RefreshTokenRepository
	jwtManager       *auth.JWTManager
	googleOAuth      *auth.GoogleOAuthProvider
	microsoftOAuth   *auth.MicrosoftOAuthProvider
	config           *config.AuthConfig
}

// NewAuthService creates a new auth service
func NewAuthService(
	userRepo repository.UserRepository,
	roleRepo repository.RoleRepository,
	refreshTokenRepo repository.RefreshTokenRepository,
	cfg *config.AuthConfig,
) *AuthService {
	jwtManager := auth.NewJWTManager(
		cfg.AccessTokenSecret,
		cfg.RefreshTokenSecret,
		cfg.AccessTokenExpiry,
		cfg.RefreshTokenExpiry,
	)

	var googleOAuth *auth.GoogleOAuthProvider
	if cfg.GoogleClientID != "" && cfg.GoogleClientSecret != "" {
		googleOAuth = auth.NewGoogleOAuthProvider(
			cfg.GoogleClientID,
			cfg.GoogleClientSecret,
			cfg.GoogleRedirectURL,
		)
	}

	var microsoftOAuth *auth.MicrosoftOAuthProvider
	if cfg.MicrosoftClientID != "" && cfg.MicrosoftClientSecret != "" {
		microsoftOAuth = auth.NewMicrosoftOAuthProvider(
			cfg.MicrosoftClientID,
			cfg.MicrosoftClientSecret,
			cfg.MicrosoftTenantID,
			cfg.MicrosoftRedirectURL,
		)
	}

	return &AuthService{
		userRepo:         userRepo,
		roleRepo:         roleRepo,
		refreshTokenRepo: refreshTokenRepo,
		jwtManager:       jwtManager,
		googleOAuth:      googleOAuth,
		microsoftOAuth:   microsoftOAuth,
		config:           cfg,
	}
}

// Login authenticates a user with email and password
func (s *AuthService) Login(ctx context.Context, email, password, userAgent, ipAddress string) (*domain.LoginResponse, error) {
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if user.Status != domain.UserStatusActive {
		return nil, ErrUserNotActive
	}

	if err := auth.CheckPassword(password, user.PasswordHash); err != nil {
		return nil, ErrInvalidCredentials
	}

	// Update last login
	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	// Generate tokens
	tokens, err := s.generateTokens(ctx, user, userAgent, ipAddress)
	if err != nil {
		return nil, err
	}

	// Get user with permissions
	publicUser := s.getUserWithPermissions(ctx, user)

	return &domain.LoginResponse{
		User:   publicUser,
		Tokens: *tokens,
	}, nil
}

// getUserWithPermissions returns a PublicUser with permissions populated
func (s *AuthService) getUserWithPermissions(ctx context.Context, user *domain.User) domain.PublicUser {
	publicUser := user.ToPublic()

	// Get role permissions
	role, err := s.roleRepo.GetByID(ctx, user.RoleID)
	if err == nil {
		permissions := make([]string, len(role.Permissions))
		for i, p := range role.Permissions {
			permissions[i] = string(p)
		}
		publicUser.Permissions = permissions
	}

	return publicUser
}

// RefreshTokens refreshes the access token using a refresh token
func (s *AuthService) RefreshTokens(ctx context.Context, refreshToken, userAgent, ipAddress string) (*domain.TokenPair, error) {
	// Validate refresh token JWT
	userID, err := s.jwtManager.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, err
	}

	// Hash the token to find it in DB
	tokenHash, err := auth.HashToken(refreshToken)
	if err != nil {
		return nil, err
	}

	// Check if token exists and is valid in DB
	storedToken, err := s.refreshTokenRepo.GetByToken(ctx, tokenHash)
	if err != nil {
		return nil, err
	}

	// Revoke old token
	_ = s.refreshTokenRepo.Revoke(ctx, storedToken.ID)

	// Get user
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if user.Status != domain.UserStatusActive {
		return nil, ErrUserNotActive
	}

	// Generate new tokens
	return s.generateTokens(ctx, user, userAgent, ipAddress)
}

// Logout revokes all refresh tokens for a user
func (s *AuthService) Logout(ctx context.Context, userID primitive.ObjectID) error {
	return s.refreshTokenRepo.RevokeAllByUserID(ctx, userID)
}

// GetGoogleAuthURL returns the Google OAuth authorization URL
func (s *AuthService) GetGoogleAuthURL(state string) (string, error) {
	if s.googleOAuth == nil {
		return "", errors.New("google oauth not configured")
	}
	return s.googleOAuth.GetAuthURL(state), nil
}

// GetMicrosoftAuthURL returns the Microsoft OAuth authorization URL
func (s *AuthService) GetMicrosoftAuthURL(state string) (string, error) {
	if s.microsoftOAuth == nil {
		return "", errors.New("microsoft oauth not configured")
	}
	return s.microsoftOAuth.GetAuthURL(state), nil
}

// HandleGoogleCallback handles the Google OAuth callback
func (s *AuthService) HandleGoogleCallback(ctx context.Context, code, userAgent, ipAddress string) (*domain.LoginResponse, error) {
	if s.googleOAuth == nil {
		return nil, errors.New("google oauth not configured")
	}

	// Exchange code for user info
	userInfo, err := s.googleOAuth.ExchangeCode(ctx, code)
	if err != nil {
		return nil, err
	}

	// Try to find user by Google ID
	user, err := s.userRepo.GetByGoogleID(ctx, userInfo.ID)
	if err != nil {
		// Try to find by email (user was invited but hasn't linked Google yet)
		user, err = s.userRepo.GetByEmail(ctx, userInfo.Email)
		if err != nil {
			return nil, ErrUserNotInvited
		}

		// Link Google account
		user.GoogleID = userInfo.ID
		if user.Avatar == "" && userInfo.Picture != "" {
			user.Avatar = userInfo.Picture
		}
		if err := s.userRepo.Update(ctx, user); err != nil {
			return nil, err
		}
	}

	if user.Status != domain.UserStatusActive {
		return nil, ErrUserNotActive
	}

	// Update last login
	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	// Generate tokens
	tokens, err := s.generateTokens(ctx, user, userAgent, ipAddress)
	if err != nil {
		return nil, err
	}

	// Get user with permissions
	publicUser := s.getUserWithPermissions(ctx, user)

	return &domain.LoginResponse{
		User:   publicUser,
		Tokens: *tokens,
	}, nil
}

// HandleMicrosoftCallback handles the Microsoft OAuth callback
func (s *AuthService) HandleMicrosoftCallback(ctx context.Context, code, userAgent, ipAddress string) (*domain.LoginResponse, error) {
	if s.microsoftOAuth == nil {
		return nil, errors.New("microsoft oauth not configured")
	}

	// Exchange code for user info
	userInfo, err := s.microsoftOAuth.ExchangeCode(ctx, code)
	if err != nil {
		return nil, err
	}

	// Try to find user by Microsoft ID
	user, err := s.userRepo.GetByMicrosoftID(ctx, userInfo.ID)
	if err != nil {
		// Try to find by email (user was invited but hasn't linked Microsoft yet)
		user, err = s.userRepo.GetByEmail(ctx, userInfo.Email)
		if err != nil {
			return nil, ErrUserNotInvited
		}

		// Link Microsoft account
		user.MicrosoftID = userInfo.ID
		if err := s.userRepo.Update(ctx, user); err != nil {
			return nil, err
		}
	}

	if user.Status != domain.UserStatusActive {
		return nil, ErrUserNotActive
	}

	// Update last login
	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	// Generate tokens
	tokens, err := s.generateTokens(ctx, user, userAgent, ipAddress)
	if err != nil {
		return nil, err
	}

	// Get user with permissions
	publicUser := s.getUserWithPermissions(ctx, user)

	return &domain.LoginResponse{
		User:   publicUser,
		Tokens: *tokens,
	}, nil
}

// GetCurrentUser returns the current user with their permissions
func (s *AuthService) GetCurrentUser(ctx context.Context, userID primitive.ObjectID) (*domain.PublicUser, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	publicUser := s.getUserWithPermissions(ctx, user)
	return &publicUser, nil
}

// UpdatePreferences updates user preferences (theme, etc.)
func (s *AuthService) UpdatePreferences(ctx context.Context, userID primitive.ObjectID, prefs *domain.UpdatePreferencesRequest) error {
	if prefs.ThemePreference != nil {
		return s.userRepo.UpdateThemePreference(ctx, userID, *prefs.ThemePreference)
	}
	return nil
}

// ChangePassword changes the user's password
func (s *AuthService) ChangePassword(ctx context.Context, userID primitive.ObjectID, currentPassword, newPassword string) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	// Verify current password
	if err := auth.CheckPassword(currentPassword, user.PasswordHash); err != nil {
		return ErrInvalidCredentials
	}

	// Hash new password
	hash, err := auth.HashPassword(newPassword)
	if err != nil {
		return err
	}

	now := time.Now()
	user.PasswordHash = hash
	user.MustChangePassword = false
	user.LastPasswordChange = &now

	return s.userRepo.Update(ctx, user)
}

// generateTokens generates a new token pair for a user
func (s *AuthService) generateTokens(ctx context.Context, user *domain.User, userAgent, ipAddress string) (*domain.TokenPair, error) {
	// Get role permissions
	var permissions []string
	role, err := s.roleRepo.GetByID(ctx, user.RoleID)
	if err == nil {
		permissions = make([]string, len(role.Permissions))
		for i, p := range role.Permissions {
			permissions[i] = string(p)
		}
	}

	// Generate access token
	accessToken, err := s.jwtManager.GenerateAccessToken(
		user.ID,
		user.Email,
		user.Name,
		permissions,
		string(user.ThemePreference),
	)
	if err != nil {
		return nil, err
	}

	// Generate refresh token
	refreshToken, expiresAt, err := s.jwtManager.GenerateRefreshToken(user.ID)
	if err != nil {
		return nil, err
	}

	// Hash refresh token for storage
	tokenHash, err := auth.HashToken(refreshToken)
	if err != nil {
		return nil, err
	}

	// Store refresh token
	storedToken := &domain.RefreshToken{
		Token:     tokenHash,
		UserID:    user.ID,
		UserAgent: userAgent,
		IPAddress: ipAddress,
		ExpiresAt: expiresAt,
	}
	if err := s.refreshTokenRepo.Create(ctx, storedToken); err != nil {
		return nil, err
	}

	return &domain.TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.jwtManager.GetAccessTokenExpiry().Seconds()),
	}, nil
}

// SeedAdminUser creates the default admin user if it doesn't exist
func (s *AuthService) SeedAdminUser(ctx context.Context) error {
	// First seed default roles
	if err := s.roleRepo.SeedDefaults(ctx); err != nil {
		return fmt.Errorf("failed to seed roles: %w", err)
	}

	// Get admin role
	adminRole, err := s.roleRepo.GetAdminRole(ctx)
	if err != nil {
		return fmt.Errorf("failed to get admin role: %w", err)
	}

	// Check if any admin user exists
	users, _, err := s.userRepo.GetAll(ctx, repository.UserFilter{
		RoleID:   &adminRole.ID,
		PageSize: 1,
	})
	if err != nil {
		return fmt.Errorf("failed to check existing admins: %w", err)
	}

	if len(users) > 0 {
		// Admin already exists
		return nil
	}

	// Generate random password
	password, err := auth.GenerateRandomPassword(16)
	if err != nil {
		return fmt.Errorf("failed to generate password: %w", err)
	}

	// Hash password
	passwordHash, err := auth.HashPassword(password)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Create admin user
	admin := &domain.User{
		Email:              "admin@nodetl.local",
		PasswordHash:       passwordHash,
		Name:               "Admin NodeTL",
		FirstName:          "Admin",
		LastName:           "NodeTL",
		Status:             domain.UserStatusActive,
		RoleID:             adminRole.ID,
		ThemePreference:    domain.ThemeSystem,
		MustChangePassword: true,
	}

	if err := s.userRepo.Create(ctx, admin); err != nil {
		return fmt.Errorf("failed to create admin user: %w", err)
	}

	// Print credentials to stdout for docker logs
	fmt.Println("========================================")
	fmt.Println("DEFAULT ADMIN ACCOUNT CREATED")
	fmt.Println("========================================")
	fmt.Println("Email: admin@nodetl.local")
	fmt.Println("Password:", password)
	fmt.Println("========================================")
	fmt.Println("PLEASE CHANGE THIS PASSWORD IMMEDIATELY!")
	fmt.Println("========================================")

	return nil
}

// GetJWTManager returns the JWT manager for use in middleware
func (s *AuthService) GetJWTManager() *auth.JWTManager {
	return s.jwtManager
}
