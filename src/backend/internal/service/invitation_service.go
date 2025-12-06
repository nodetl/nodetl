package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/repository"
	"github.com/nodetl/nodetl/pkg/auth"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	// InvitationExpiry is the default expiry for invitations (7 days)
	InvitationExpiry = 7 * 24 * time.Hour
)

// splitName splits a full name into first and last name
func splitName(fullName string) (firstName, lastName string) {
	parts := strings.Fields(strings.TrimSpace(fullName))
	if len(parts) == 0 {
		return "", ""
	}
	if len(parts) == 1 {
		return parts[0], ""
	}
	return parts[0], strings.Join(parts[1:], " ")
}

// InvitationService handles invitation operations
type InvitationService struct {
	invitationRepo repository.InvitationRepository
	userRepo       repository.UserRepository
	roleRepo       repository.RoleRepository
	emailService   *EmailService
	appDomain      string
}

// NewInvitationService creates a new invitation service
func NewInvitationService(
	invitationRepo repository.InvitationRepository,
	userRepo repository.UserRepository,
	roleRepo repository.RoleRepository,
	emailService *EmailService,
	appDomain string,
) *InvitationService {
	return &InvitationService{
		invitationRepo: invitationRepo,
		userRepo:       userRepo,
		roleRepo:       roleRepo,
		emailService:   emailService,
		appDomain:      appDomain,
	}
}

// CreateInvitation creates a new invitation and optionally sends an email
func (s *InvitationService) CreateInvitation(ctx context.Context, req *domain.CreateInvitationRequest, createdBy primitive.ObjectID, sendEmail bool) (*domain.InvitationResponse, string, error) {
	// Check if user already exists
	existingUser, _ := s.userRepo.GetByEmail(ctx, req.Email)
	if existingUser != nil {
		return nil, "", repository.ErrUserAlreadyExists
	}

	// Validate role exists
	role, err := s.roleRepo.GetByID(ctx, req.RoleID)
	if err != nil {
		return nil, "", err
	}

	// Generate secure token
	token, err := auth.GenerateSecureToken(32)
	if err != nil {
		return nil, "", err
	}

	// Hash token for storage
	tokenHash, err := auth.HashToken(token)
	if err != nil {
		return nil, "", err
	}

	// Create invitation
	invitation := &domain.Invitation{
		Email:     req.Email,
		Name:      req.Name,
		Token:     tokenHash,
		RoleID:    req.RoleID,
		Status:    domain.InvitationStatusPending,
		ExpiresAt: time.Now().Add(InvitationExpiry),
		CreatedBy: createdBy,
	}

	if err := s.invitationRepo.Create(ctx, invitation); err != nil {
		return nil, "", err
	}

	// Generate invitation link
	inviteLink := fmt.Sprintf("%s/invite/accept?token=%s", s.appDomain, token)

	// Send email if configured and requested
	if sendEmail && s.emailService != nil && s.emailService.IsConfigured() {
		if err := s.emailService.SendInvitation(req.Email, req.Name, inviteLink); err != nil {
			// Log error but don't fail - admin can share link manually
			fmt.Printf("Warning: Failed to send invitation email: %v\n", err)
		}
	}

	return &domain.InvitationResponse{
		ID:        invitation.ID,
		Email:     invitation.Email,
		Name:      invitation.Name,
		RoleID:    invitation.RoleID,
		RoleName:  role.Name,
		Status:    invitation.Status,
		ExpiresAt: invitation.ExpiresAt,
		CreatedAt: invitation.CreatedAt,
		Link:      inviteLink,
	}, token, nil
}

// AcceptInvitation accepts an invitation and creates the user account
func (s *InvitationService) AcceptInvitation(ctx context.Context, token, password, name string) (*domain.User, error) {
	// Find invitation by trying each stored invitation
	invitations, _, err := s.invitationRepo.GetAll(ctx, repository.InvitationFilter{
		Status:   ptrInvitationStatus(domain.InvitationStatusPending),
		PageSize: 1000, // Get all pending
	})
	if err != nil {
		return nil, err
	}

	var invitation *domain.Invitation
	for _, inv := range invitations {
		if err := auth.CheckToken(token, inv.Token); err == nil {
			invitation = &inv
			break
		}
	}

	if invitation == nil {
		return nil, repository.ErrInvitationNotFound
	}

	if !invitation.IsValid() {
		return nil, repository.ErrInvitationExpired
	}

	// Hash password
	passwordHash, err := auth.HashPassword(password)
	if err != nil {
		return nil, err
	}

	// Use provided name or invitation name
	userName := invitation.Name
	if name != "" {
		userName = name
	}

	// Split name into first and last name
	firstName, lastName := splitName(userName)

	// Create user
	user := &domain.User{
		Email:              invitation.Email,
		PasswordHash:       passwordHash,
		Name:               userName,
		FirstName:          firstName,
		LastName:           lastName,
		Status:             domain.UserStatusActive,
		RoleID:             invitation.RoleID,
		ThemePreference:    domain.ThemeSystem,
		MustChangePassword: false,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	// Mark invitation as accepted
	if err := s.invitationRepo.MarkAccepted(ctx, invitation.ID); err != nil {
		// Log but don't fail - user is created
		fmt.Printf("Warning: Failed to mark invitation as accepted: %v\n", err)
	}

	return user, nil
}

// AcceptInvitationSSO accepts an invitation via SSO (Google/Microsoft)
func (s *InvitationService) AcceptInvitationSSO(ctx context.Context, token string, ssoInfo *auth.OAuthUserInfo) (*domain.User, error) {
	// Find invitation
	invitations, _, err := s.invitationRepo.GetAll(ctx, repository.InvitationFilter{
		Status:   ptrInvitationStatus(domain.InvitationStatusPending),
		PageSize: 1000,
	})
	if err != nil {
		return nil, err
	}

	var invitation *domain.Invitation
	for _, inv := range invitations {
		if err := auth.CheckToken(token, inv.Token); err == nil {
			invitation = &inv
			break
		}
	}

	if invitation == nil {
		return nil, repository.ErrInvitationNotFound
	}

	if !invitation.IsValid() {
		return nil, repository.ErrInvitationExpired
	}

	// Verify email matches
	if invitation.Email != ssoInfo.Email {
		return nil, fmt.Errorf("SSO email does not match invitation email")
	}

	// Split name into first and last name
	firstName, lastName := splitName(ssoInfo.Name)

	// Create user with SSO
	user := &domain.User{
		Email:           invitation.Email,
		Name:            ssoInfo.Name,
		FirstName:       firstName,
		LastName:        lastName,
		Avatar:          ssoInfo.Picture,
		Status:          domain.UserStatusActive,
		RoleID:          invitation.RoleID,
		ThemePreference: domain.ThemeSystem,
	}

	// Set provider ID
	switch ssoInfo.Provider {
	case "google":
		user.GoogleID = ssoInfo.ID
	case "microsoft":
		user.MicrosoftID = ssoInfo.ID
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	// Mark invitation as accepted
	_ = s.invitationRepo.MarkAccepted(ctx, invitation.ID)

	return user, nil
}

// GetInvitation returns invitation details by ID
func (s *InvitationService) GetInvitation(ctx context.Context, id primitive.ObjectID) (*domain.InvitationResponse, error) {
	invitation, err := s.invitationRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	role, _ := s.roleRepo.GetByID(ctx, invitation.RoleID)
	roleName := ""
	if role != nil {
		roleName = role.Name
	}

	return &domain.InvitationResponse{
		ID:        invitation.ID,
		Email:     invitation.Email,
		Name:      invitation.Name,
		RoleID:    invitation.RoleID,
		RoleName:  roleName,
		Status:    invitation.Status,
		ExpiresAt: invitation.ExpiresAt,
		CreatedAt: invitation.CreatedAt,
	}, nil
}

// ListInvitations returns all invitations
func (s *InvitationService) ListInvitations(ctx context.Context, filter repository.InvitationFilter) ([]domain.InvitationResponse, int64, error) {
	invitations, total, err := s.invitationRepo.GetAll(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	// Get roles for response
	roles, _ := s.roleRepo.GetAll(ctx)
	roleMap := make(map[primitive.ObjectID]string)
	for _, r := range roles {
		roleMap[r.ID] = r.Name
	}

	responses := make([]domain.InvitationResponse, len(invitations))
	for i, inv := range invitations {
		responses[i] = domain.InvitationResponse{
			ID:        inv.ID,
			Email:     inv.Email,
			Name:      inv.Name,
			RoleID:    inv.RoleID,
			RoleName:  roleMap[inv.RoleID],
			Status:    inv.Status,
			ExpiresAt: inv.ExpiresAt,
			CreatedAt: inv.CreatedAt,
		}
	}

	return responses, total, nil
}

// RevokeInvitation revokes a pending invitation
func (s *InvitationService) RevokeInvitation(ctx context.Context, id primitive.ObjectID) error {
	invitation, err := s.invitationRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if invitation.Status != domain.InvitationStatusPending {
		return fmt.Errorf("can only revoke pending invitations")
	}

	invitation.Status = domain.InvitationStatusRevoked
	return s.invitationRepo.Update(ctx, invitation)
}

// ResendInvitation resends an invitation email
func (s *InvitationService) ResendInvitation(ctx context.Context, id primitive.ObjectID) (string, error) {
	invitation, err := s.invitationRepo.GetByID(ctx, id)
	if err != nil {
		return "", err
	}

	if invitation.Status != domain.InvitationStatusPending {
		return "", fmt.Errorf("can only resend pending invitations")
	}

	// Generate new token
	token, err := auth.GenerateSecureToken(32)
	if err != nil {
		return "", err
	}

	tokenHash, err := auth.HashToken(token)
	if err != nil {
		return "", err
	}

	// Update invitation
	invitation.Token = tokenHash
	invitation.ExpiresAt = time.Now().Add(InvitationExpiry)
	if err := s.invitationRepo.Update(ctx, invitation); err != nil {
		return "", err
	}

	// Generate link
	inviteLink := fmt.Sprintf("%s/invite/accept?token=%s", s.appDomain, token)

	// Send email
	if s.emailService != nil && s.emailService.IsConfigured() {
		if err := s.emailService.SendInvitation(invitation.Email, invitation.Name, inviteLink); err != nil {
			fmt.Printf("Warning: Failed to send invitation email: %v\n", err)
		}
	}

	return inviteLink, nil
}

func ptrInvitationStatus(s domain.InvitationStatus) *domain.InvitationStatus {
	return &s
}
