package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrPasswordTooShort = errors.New("password must be at least 8 characters")
	ErrPasswordMismatch = errors.New("password does not match")
)

const (
	// bcrypt cost factor
	bcryptCost = 12
	// Minimum password length
	minPasswordLength = 8
)

// HashPassword hashes a password using bcrypt
func HashPassword(password string) (string, error) {
	if len(password) < minPasswordLength {
		return "", ErrPasswordTooShort
	}

	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return "", err
	}

	return string(bytes), nil
}

// CheckPassword checks if a password matches a hash
func CheckPassword(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// GenerateRandomPassword generates a random password of given length
func GenerateRandomPassword(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	// Use base64 encoding and take first 'length' characters
	password := base64.URLEncoding.EncodeToString(bytes)[:length]
	return password, nil
}

// GenerateSecureToken generates a cryptographically secure random token
func GenerateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return base64.URLEncoding.EncodeToString(bytes), nil
}

// HashToken hashes a token for secure storage using SHA256
// (bcrypt has a 72 byte limit which is too short for JWT tokens)
func HashToken(token string) (string, error) {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:]), nil
}

// CheckToken checks if a token matches a hash
func CheckToken(token, hash string) error {
	computedHash := sha256.Sum256([]byte(token))
	if hex.EncodeToString(computedHash[:]) != hash {
		return errors.New("token mismatch")
	}
	return nil
}
