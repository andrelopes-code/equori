// Package app implements the identity use cases.
package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/identity/internal/password"
)

var (
	ErrNotFound           = errors.New("not found")
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrTooManyAttempts    = errors.New("too many failed login attempts")
	ErrUnauthenticated    = errors.New("unauthenticated")
)

// Repository returns ErrNotFound for missing rows and ErrEmailTaken on duplicate email.
type Repository interface {
	CreateUser(ctx context.Context, u domain.User) (domain.User, error)
	UserByEmail(ctx context.Context, email string) (domain.User, error)
	CreateSession(ctx context.Context, s domain.Session) error
	UserBySession(ctx context.Context, tokenHash []byte, now time.Time) (domain.User, error)
	DeleteSession(ctx context.Context, tokenHash []byte) error
	DeleteExpiredSessions(ctx context.Context, now time.Time) error
}

type Service struct {
	repo     Repository
	now      func() time.Time
	throttle *throttle
	// dummyHash is verified when the email is unknown, so both failure paths cost one argon2id run.
	dummyHash string
}

func NewService(repo Repository, now func() time.Time) *Service {
	return &Service{
		repo:      repo,
		now:       now,
		throttle:  newThrottle(5, 15*time.Minute),
		dummyHash: password.Hash("dummy password for timing equalization"),
	}
}

func (s *Service) CreateUser(ctx context.Context, email, plain string, role domain.Role) (domain.User, error) {
	email, err := domain.NormalizeEmail(email)
	if err != nil {
		return domain.User{}, err
	}
	if err := domain.ValidatePassword(plain); err != nil {
		return domain.User{}, err
	}
	if !role.Valid() {
		return domain.User{}, domain.ErrInvalidRole
	}
	return s.repo.CreateUser(ctx, domain.User{Email: email, PasswordHash: password.Hash(plain), Role: role})
}

type Session struct {
	Token     string
	ExpiresAt time.Time
}

func (s *Service) Login(ctx context.Context, email, plain string) (Session, error) {
	now := s.now()
	email, emailErr := domain.NormalizeEmail(email)
	// Byte bound equivalent to MaxPasswordLength runes (at most 4 bytes each); rejects before hashing.
	if emailErr != nil || len(plain) > 4*domain.MaxPasswordLength {
		return Session{}, ErrInvalidCredentials
	}
	if !s.throttle.allowed(email, now) {
		return Session{}, ErrTooManyAttempts
	}

	user, err := s.repo.UserByEmail(ctx, email)
	switch {
	case errors.Is(err, ErrNotFound):
		_, _ = password.Verify(plain, s.dummyHash)
		s.throttle.fail(email, now)
		return Session{}, ErrInvalidCredentials
	case err != nil:
		return Session{}, fmt.Errorf("load user: %w", err)
	}
	ok, err := password.Verify(plain, user.PasswordHash)
	if err != nil {
		return Session{}, fmt.Errorf("verify password of user %d: %w", user.ID, err)
	}
	if !ok || user.Disabled {
		s.throttle.fail(email, now)
		return Session{}, ErrInvalidCredentials
	}
	s.throttle.reset(email)

	if err := s.repo.DeleteExpiredSessions(ctx, now); err != nil {
		return Session{}, fmt.Errorf("delete expired sessions: %w", err)
	}
	token, session := domain.NewSession(user.ID, now)
	if err := s.repo.CreateSession(ctx, session); err != nil {
		return Session{}, fmt.Errorf("create session: %w", err)
	}
	return Session{Token: token, ExpiresAt: session.ExpiresAt}, nil
}

func (s *Service) Logout(ctx context.Context, token string) error {
	return s.repo.DeleteSession(ctx, domain.HashToken(token))
}

// Authenticate returns ErrUnauthenticated for unknown or expired tokens and disabled users.
func (s *Service) Authenticate(ctx context.Context, token string) (domain.User, error) {
	user, err := s.repo.UserBySession(ctx, domain.HashToken(token), s.now())
	switch {
	case errors.Is(err, ErrNotFound):
		return domain.User{}, ErrUnauthenticated
	case err != nil:
		return domain.User{}, fmt.Errorf("load session: %w", err)
	case user.Disabled:
		return domain.User{}, ErrUnauthenticated
	}
	return user, nil
}
