// Package app implements the identity use cases.
package app

import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/identity/internal/password"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

var (
	ErrNotFound           = errors.New("not found")
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrTooManyAttempts    = errors.New("too many login attempts")
	ErrUnauthenticated    = errors.New("unauthenticated")
	ErrBusy               = errors.New("too many concurrent password operations")
)

// Repository returns ErrNotFound for missing rows and ErrEmailTaken on duplicate email.
type Repository interface {
	CreateUser(ctx context.Context, u domain.User, base money.Currency) (domain.User, error)
	// CreateFirstUser returns ErrSetupComplete when a user exists.
	CreateFirstUser(ctx context.Context, u domain.User, base money.Currency) (domain.User, error)
	AnyUser(ctx context.Context) (bool, error)
	UpdateProfile(ctx context.Context, userID int64, l locale.Locale) (domain.User, error)
	UserByID(ctx context.Context, userID int64) (domain.User, error)
	UserByEmail(ctx context.Context, email string) (domain.User, error)
	CreateSession(ctx context.Context, s domain.Session) error
	UserBySession(ctx context.Context, tokenHash []byte, now time.Time) (domain.User, error)
	DeleteSession(ctx context.Context, tokenHash []byte) error
	DeleteExpiredSessions(ctx context.Context, now time.Time) error
	AccessTokenRepository
}

const (
	loginAttemptLimit  = 5
	loginAttemptWindow = 15 * time.Minute
	// hashSlotWait bounds how long a request queues for a password slot before ErrBusy.
	hashSlotWait = 5 * time.Second
)

type Service struct {
	repo     Repository
	now      func() time.Time
	throttle *throttle
	// hashSlots caps concurrent argon2id runs; each one allocates 19 MiB.
	hashSlots chan struct{}
	// dummyHash is verified when the email is unknown, so both failure paths cost one argon2id run.
	dummyHash string
	setup     setup
}

func NewService(repo Repository, now func() time.Time) *Service {
	return &Service{
		repo:      repo,
		now:       now,
		throttle:  newThrottle(loginAttemptLimit, loginAttemptWindow),
		hashSlots: make(chan struct{}, runtime.NumCPU()),
		dummyHash: password.Hash("dummy password for timing equalization"),
	}
}

func (s *Service) CreateUser(ctx context.Context, email, plain string, role domain.Role, l locale.Locale, base money.Currency) (domain.User, error) {
	u, err := s.newUser(ctx, email, plain, role, l, base)
	if err != nil {
		return domain.User{}, err
	}
	return s.repo.CreateUser(ctx, u, base)
}

// newUser validates a new user and hashes its password.
func (s *Service) newUser(ctx context.Context, email, plain string, role domain.Role, l locale.Locale, base money.Currency) (domain.User, error) {
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
	if err := validateLocale(l); err != nil {
		return domain.User{}, err
	}
	if _, err := money.ParseCurrency(string(base)); err != nil {
		return domain.User{}, &domain.FieldError{Field: "base_currency", Message: "must be an ISO 4217 currency code"}
	}
	release, err := s.acquireHashSlot(ctx)
	if err != nil {
		return domain.User{}, err
	}
	hash := password.Hash(plain)
	release()
	return domain.User{Email: email, PasswordHash: hash, Role: role, Language: l.Language, Region: l.Region}, nil
}

func validateLocale(l locale.Locale) error {
	if !locale.ValidLanguage(l.Language) {
		return &domain.FieldError{Field: "language", Message: "must be an ISO 639 language code"}
	}
	if !locale.ValidRegion(l.Region) {
		return &domain.FieldError{Field: "region", Message: "must be an ISO 3166-1 alpha-2 code"}
	}
	return nil
}

// Profile returns the language and region of a user.
func (s *Service) Profile(ctx context.Context, userID int64) (locale.Locale, error) {
	user, err := s.repo.UserByID(ctx, userID)
	if err != nil {
		return locale.Locale{}, fmt.Errorf("load user %d: %w", userID, err)
	}
	return locale.Locale{Language: user.Language, Region: user.Region}, nil
}

// ProfileChange returns a user's language and region before and after UpdateProfile with the
// same arguments, validated, without storing anything.
func (s *Service) ProfileChange(ctx context.Context, userID int64, language, region string) (before, after locale.Locale, err error) {
	before, err = s.Profile(ctx, userID)
	if err != nil {
		return locale.Locale{}, locale.Locale{}, err
	}
	after = before
	if language != "" {
		after.Language = language
	}
	if region != "" {
		after.Region = region
	}
	return before, after, validateLocale(after)
}

// UpdateProfile changes the language and region of a user; an empty field keeps the stored value.
func (s *Service) UpdateProfile(ctx context.Context, current domain.User, language, region string) (domain.User, error) {
	l := locale.Locale{Language: current.Language, Region: current.Region}
	if language != "" {
		l.Language = language
	}
	if region != "" {
		l.Region = region
	}
	if err := validateLocale(l); err != nil {
		return domain.User{}, err
	}
	return s.repo.UpdateProfile(ctx, current.ID, l)
}

type Session struct {
	UserID    int64
	Token     string
	ExpiresAt time.Time
}

// Login counts every attempt against the email, including the successful one,
// which then clears the count.
func (s *Service) Login(ctx context.Context, email, plain string) (Session, error) {
	now := s.now()
	email, emailErr := domain.NormalizeEmail(email)
	// Byte bound equivalent to MaxPasswordLength runes (at most 4 bytes each); rejects before hashing.
	if emailErr != nil || len(plain) > 4*domain.MaxPasswordLength {
		return Session{}, ErrInvalidCredentials
	}
	if !s.throttle.attempt(email, now) {
		return Session{}, ErrTooManyAttempts
	}

	user, err := s.repo.UserByEmail(ctx, email)
	switch {
	case errors.Is(err, ErrNotFound):
		if _, err := s.verify(ctx, plain, s.dummyHash); err != nil {
			return Session{}, err
		}
		return Session{}, ErrInvalidCredentials
	case err != nil:
		return Session{}, fmt.Errorf("load user: %w", err)
	}
	ok, err := s.verify(ctx, plain, user.PasswordHash)
	if err != nil {
		return Session{}, fmt.Errorf("verify password of user %d: %w", user.ID, err)
	}
	if !ok || user.Disabled {
		return Session{}, ErrInvalidCredentials
	}
	s.throttle.reset(email)

	if err := s.repo.DeleteExpiredSessions(ctx, now); err != nil {
		return Session{}, fmt.Errorf("delete expired sessions: %w", err)
	}
	return s.startSession(ctx, user.ID, now)
}

func (s *Service) startSession(ctx context.Context, userID int64, now time.Time) (Session, error) {
	token, session := domain.NewSession(userID, now)
	if err := s.repo.CreateSession(ctx, session); err != nil {
		return Session{}, fmt.Errorf("create session: %w", err)
	}
	return Session{UserID: userID, Token: token, ExpiresAt: session.ExpiresAt}, nil
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

func (s *Service) verify(ctx context.Context, plain, hash string) (bool, error) {
	release, err := s.acquireHashSlot(ctx)
	if err != nil {
		return false, err
	}
	defer release()
	return password.Verify(plain, hash)
}

func (s *Service) acquireHashSlot(ctx context.Context) (release func(), err error) {
	ctx, cancel := context.WithTimeout(ctx, hashSlotWait)
	defer cancel()
	select {
	case s.hashSlots <- struct{}{}:
		return func() { <-s.hashSlots }, nil
	case <-ctx.Done():
		return nil, ErrBusy
	}
}
