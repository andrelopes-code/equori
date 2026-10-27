package app

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
)

var (
	ErrAccessTokenNotFound = errors.New("access token not found")
	ErrInvalidAccessToken  = errors.New("invalid access token")
)

// AccessTokenRepository stores personal access tokens; every method but AccessTokenByHash filters by user.
type AccessTokenRepository interface {
	CreateAccessToken(ctx context.Context, t domain.AccessToken) error
	AccessTokens(ctx context.Context, userID int64) ([]domain.AccessToken, error)
	// DeleteAccessToken returns ErrAccessTokenNotFound when the user has no token with id.
	DeleteAccessToken(ctx context.Context, userID int64, id uuid.UUID) error
	// AccessTokenByHash returns ErrNotFound for an unknown or expired token.
	AccessTokenByHash(ctx context.Context, hash []byte, now time.Time) (domain.AccessToken, error)
	TouchAccessToken(ctx context.Context, t domain.AccessToken, now time.Time) error
}

// CreateAccessToken returns the token text, shown to the user once, and its record (design 2026-10-26 X5-X7).
func (s *Service) CreateAccessToken(ctx context.Context, userID int64, name, scope string, days int) (string, domain.AccessToken, error) {
	text, t, err := domain.NewAccessToken(userID, name, scope, days, s.now())
	if err != nil {
		return "", domain.AccessToken{}, err
	}
	if err := s.repo.CreateAccessToken(ctx, t); err != nil {
		return "", domain.AccessToken{}, err
	}
	return text, t, nil
}

func (s *Service) AccessTokens(ctx context.Context, userID int64) ([]domain.AccessToken, error) {
	return s.repo.AccessTokens(ctx, userID)
}

func (s *Service) DeleteAccessToken(ctx context.Context, userID int64, id uuid.UUID) error {
	return s.repo.DeleteAccessToken(ctx, userID, id)
}

// VerifyAccessToken returns the record of a valid token and notes its use at most once a minute (X8).
// A malformed, unknown, expired or deleted token is ErrInvalidAccessToken.
func (s *Service) VerifyAccessToken(ctx context.Context, text string) (domain.AccessToken, error) {
	if !strings.HasPrefix(text, domain.AccessTokenPrefix) {
		return domain.AccessToken{}, ErrInvalidAccessToken
	}
	now := s.now()
	t, err := s.repo.AccessTokenByHash(ctx, domain.HashToken(text), now)
	if errors.Is(err, ErrNotFound) {
		return domain.AccessToken{}, ErrInvalidAccessToken
	}
	if err != nil {
		return domain.AccessToken{}, err
	}
	if err := s.repo.TouchAccessToken(ctx, t, now); err != nil {
		return domain.AccessToken{}, err
	}
	return t, nil
}
