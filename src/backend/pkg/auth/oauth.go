package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var (
	ErrOAuthFailed       = errors.New("oauth authentication failed")
	ErrOAuthInvalidState = errors.New("invalid oauth state")
	ErrOAuthNoEmail      = errors.New("email not provided by oauth provider")
)

// OAuthUserInfo represents user info from OAuth provider
type OAuthUserInfo struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Picture  string `json:"picture,omitempty"`
	Provider string `json:"provider"`
}

// GoogleOAuthProvider handles Google OAuth
type GoogleOAuthProvider struct {
	clientID     string
	clientSecret string
	redirectURL  string
}

// NewGoogleOAuthProvider creates a new Google OAuth provider
func NewGoogleOAuthProvider(clientID, clientSecret, redirectURL string) *GoogleOAuthProvider {
	return &GoogleOAuthProvider{
		clientID:     clientID,
		clientSecret: clientSecret,
		redirectURL:  redirectURL,
	}
}

// GetAuthURL returns the Google OAuth authorization URL
func (g *GoogleOAuthProvider) GetAuthURL(state string) string {
	params := url.Values{
		"client_id":     {g.clientID},
		"redirect_uri":  {g.redirectURL},
		"response_type": {"code"},
		"scope":         {"openid email profile"},
		"state":         {state},
		"access_type":   {"offline"},
	}
	return "https://accounts.google.com/o/oauth2/v2/auth?" + params.Encode()
}

// ExchangeCode exchanges an authorization code for user info
func (g *GoogleOAuthProvider) ExchangeCode(ctx context.Context, code string) (*OAuthUserInfo, error) {
	// Exchange code for token
	tokenURL := "https://oauth2.googleapis.com/token"
	data := url.Values{
		"client_id":     {g.clientID},
		"client_secret": {g.clientSecret},
		"code":          {code},
		"grant_type":    {"authorization_code"},
		"redirect_uri":  {g.redirectURL},
	}

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%w: token exchange failed: %s", ErrOAuthFailed, string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		IDToken     string `json:"id_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}

	// Get user info
	userInfoURL := "https://www.googleapis.com/oauth2/v2/userinfo"
	req, err = http.NewRequestWithContext(ctx, "GET", userInfoURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)

	resp, err = client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%w: userinfo failed: %s", ErrOAuthFailed, string(body))
	}

	var userInfo struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, err
	}

	if userInfo.Email == "" {
		return nil, ErrOAuthNoEmail
	}

	return &OAuthUserInfo{
		ID:       userInfo.ID,
		Email:    userInfo.Email,
		Name:     userInfo.Name,
		Picture:  userInfo.Picture,
		Provider: "google",
	}, nil
}

// MicrosoftOAuthProvider handles Microsoft OAuth
type MicrosoftOAuthProvider struct {
	clientID     string
	clientSecret string
	tenantID     string
	redirectURL  string
}

// NewMicrosoftOAuthProvider creates a new Microsoft OAuth provider
func NewMicrosoftOAuthProvider(clientID, clientSecret, tenantID, redirectURL string) *MicrosoftOAuthProvider {
	if tenantID == "" {
		tenantID = "common"
	}
	return &MicrosoftOAuthProvider{
		clientID:     clientID,
		clientSecret: clientSecret,
		tenantID:     tenantID,
		redirectURL:  redirectURL,
	}
}

// GetAuthURL returns the Microsoft OAuth authorization URL
func (m *MicrosoftOAuthProvider) GetAuthURL(state string) string {
	params := url.Values{
		"client_id":     {m.clientID},
		"redirect_uri":  {m.redirectURL},
		"response_type": {"code"},
		"scope":         {"openid email profile User.Read"},
		"state":         {state},
		"response_mode": {"query"},
	}
	return fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/authorize?%s", m.tenantID, params.Encode())
}

// ExchangeCode exchanges an authorization code for user info
func (m *MicrosoftOAuthProvider) ExchangeCode(ctx context.Context, code string) (*OAuthUserInfo, error) {
	// Exchange code for token
	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", m.tenantID)
	data := url.Values{
		"client_id":     {m.clientID},
		"client_secret": {m.clientSecret},
		"code":          {code},
		"grant_type":    {"authorization_code"},
		"redirect_uri":  {m.redirectURL},
		"scope":         {"openid email profile User.Read"},
	}

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%w: token exchange failed: %s", ErrOAuthFailed, string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}

	// Get user info from Microsoft Graph
	graphURL := "https://graph.microsoft.com/v1.0/me"
	req, err = http.NewRequestWithContext(ctx, "GET", graphURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)

	resp, err = client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%w: graph api failed: %s", ErrOAuthFailed, string(body))
	}

	var userInfo struct {
		ID                string `json:"id"`
		UserPrincipalName string `json:"userPrincipalName"`
		Mail              string `json:"mail"`
		DisplayName       string `json:"displayName"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, err
	}

	email := userInfo.Mail
	if email == "" {
		email = userInfo.UserPrincipalName
	}
	if email == "" {
		return nil, ErrOAuthNoEmail
	}

	return &OAuthUserInfo{
		ID:       userInfo.ID,
		Email:    email,
		Name:     userInfo.DisplayName,
		Provider: "microsoft",
	}, nil
}
