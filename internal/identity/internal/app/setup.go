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
	ErrSetupComplete     = errors.New("the first member exists")
)

// SetupHooks connect the setup to the rest of the instance: the default base currency of a
// region (ADR 016), the update check consent of the instance and the removal of setup.url.
type SetupHooks struct {
	DefaultCurrency func(region string) (money.Currency, bool)
	UpdateCheck     func(ctx context.Context, consent bool) error
	Done            func()
}

type setup struct {
	mu    sync.Mutex
	token string
	hooks SetupHooks
}

func (s *Service) UseSetupHooks(h SetupHooks) { s.setup.hooks = h }

// UseUpdateCheck sets the hook that stores the update check consent given at setup.
func (s *Service) UseUpdateCheck(f func(ctx context.Context, consent bool) error) {
	s.setup.hooks.UpdateCheck = f
}

// StartSetup returns a new setup token while no member exists, and "" afterwards (W-U1). The token
// lives in memory only: a restart issues another.
func (s *Service) StartSetup(ctx context.Context) (string, error) {
	exists, err := s.repo.AnyMember(ctx)
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
	exists, err := s.repo.AnyMember(ctx)
	return !exists, err
}

// CompleteSetup creates the first member, an admin, and signs it in (W-U3, W-U4).
func (s *Service) CompleteSetup(ctx context.Context, token, email, plain string, l locale.Locale, base money.Currency, updateCheck bool) (Session, domain.Member, error) {
	required, err := s.SetupRequired(ctx)
	if err != nil {
		return Session{}, domain.Member{}, err
	}

	if !required {
		return Session{}, domain.Member{}, ErrSetupComplete
	}

	s.setup.mu.Lock()
	stored := s.setup.token
	s.setup.mu.Unlock()

	if stored == "" || subtle.ConstantTimeCompare([]byte(token), []byte(stored)) != 1 {
		return Session{}, domain.Member{}, ErrSetupTokenInvalid
	}

	base, err = s.baseCurrency(l.Region, base)
	if err != nil {
		return Session{}, domain.Member{}, err
	}

	u, err := s.newMember(ctx, email, plain, domain.RoleAdmin, l.Language)
	if err != nil {
		return Session{}, domain.Member{}, err
	}

	if err := validateBooks(l.Region, base); err != nil {
		return Session{}, domain.Member{}, err
	}

	created, booksID, err := s.repo.CreateFirstMember(ctx, u, l.Region, base)
	if err != nil {
		return Session{}, domain.Member{}, err
	}

	s.setup.mu.Lock()
	s.setup.token = ""
	s.setup.mu.Unlock()

	if s.setup.hooks.UpdateCheck != nil {
		if err := s.setup.hooks.UpdateCheck(ctx, updateCheck); err != nil {
			return Session{}, domain.Member{}, fmt.Errorf("store update check: %w", err)
		}
	}

	if s.setup.hooks.Done != nil {
		s.setup.hooks.Done()
	}

	session, err := s.startSession(ctx, created.ID, booksID, s.now())
	if err != nil {
		return Session{}, domain.Member{}, err
	}

	return session, created, nil
}

// baseCurrency returns base, or the default of region when base is empty; a region without a
// default is a field error on base_currency (ADR 016).
func (s *Service) baseCurrency(region string, base money.Currency) (money.Currency, error) {
	if base != "" || !locale.ValidRegion(region) {
		return base, nil
	}

	if s.setup.hooks.DefaultCurrency != nil {
		if def, ok := s.setup.hooks.DefaultCurrency(region); ok {
			return def, nil
		}
	}

	return "", &domain.FieldError{Field: "base_currency", Message: "is required for this region"}
}
