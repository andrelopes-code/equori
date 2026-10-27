package app

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"sync"

	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

var (
	ErrSetupTokenInvalid = errors.New("the setup token differs")
	ErrSetupComplete     = errors.New("the first user exists")
)

// SetupHooks connect the setup to the rest of the instance: the default base currency of a
// region (ADR 016) and the removal of setup.url.
type SetupHooks struct {
	DefaultCurrency func(region string) (money.Currency, bool)
	Done            func()
}

type setup struct {
	mu    sync.Mutex
	token string
	hooks SetupHooks
}

func (s *Service) UseSetupHooks(h SetupHooks) { s.setup.hooks = h }

// StartSetup returns a new setup token while no user exists, and "" afterwards (W-U1). The token
// lives in memory only: a restart issues another.
func (s *Service) StartSetup(ctx context.Context) (string, error) {
	exists, err := s.repo.AnyUser(ctx)
	if err != nil || exists {
		return "", err
	}
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate setup token: %w", err)
	}
	s.setup.mu.Lock()
	defer s.setup.mu.Unlock()
	s.setup.token = base64.RawURLEncoding.EncodeToString(b)
	return s.setup.token, nil
}

func (s *Service) SetupRequired(ctx context.Context) (bool, error) {
	exists, err := s.repo.AnyUser(ctx)
	return !exists, err
}

// CompleteSetup creates the first user, an admin, and signs it in (W-U3, W-U4).
func (s *Service) CompleteSetup(ctx context.Context, token, email, plain string, l locale.Locale, base money.Currency) (Session, domain.User, error) {
	required, err := s.SetupRequired(ctx)
	if err != nil {
		return Session{}, domain.User{}, err
	}
	if !required {
		return Session{}, domain.User{}, ErrSetupComplete
	}
	s.setup.mu.Lock()
	stored := s.setup.token
	s.setup.mu.Unlock()
	if stored == "" || subtle.ConstantTimeCompare([]byte(token), []byte(stored)) != 1 {
		return Session{}, domain.User{}, ErrSetupTokenInvalid
	}
	if base == "" && locale.ValidRegion(l.Region) {
		var ok bool
		if s.setup.hooks.DefaultCurrency != nil {
			base, ok = s.setup.hooks.DefaultCurrency(l.Region)
		}
		if !ok {
			return Session{}, domain.User{}, &domain.FieldError{Field: "base_currency", Message: "is required for this region"}
		}
	}
	u, err := s.newUser(ctx, email, plain, domain.RoleAdmin, l, base)
	if err != nil {
		return Session{}, domain.User{}, err
	}
	created, err := s.repo.CreateFirstUser(ctx, u, base)
	if err != nil {
		return Session{}, domain.User{}, err
	}
	s.setup.mu.Lock()
	s.setup.token = ""
	s.setup.mu.Unlock()
	if s.setup.hooks.Done != nil {
		s.setup.hooks.Done()
	}
	session, err := s.startSession(ctx, created.ID, s.now())
	if err != nil {
		return Session{}, domain.User{}, err
	}
	return session, created, nil
}
