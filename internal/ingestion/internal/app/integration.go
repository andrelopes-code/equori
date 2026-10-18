package app

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

var (
	// ErrIntegrationUnavailable: the instance has no EQUORI_SECRET_KEY (ADR 008 K2).
	ErrIntegrationUnavailable = errors.New("integrations need EQUORI_SECRET_KEY")
	ErrCredentialsUnreadable  = fmt.Errorf("%w: the stored credentials do not open with the configured key; enter them again", ErrIntegrationUnavailable)
	ErrIntegrationInUse       = errors.New("the integration has connections")
	ErrProviderUnauthorized   = errors.New("the provider rejected the credentials")
	ErrProviderUnavailable    = errors.New("the provider did not answer")
	ErrItemNotFound           = errors.New("the provider has no such item for these credentials")
	ErrAccountGone            = errors.New("the provider no longer lists a mapped account")
)

// UnauthorizedError names the request field whose credentials the provider rejected.
type UnauthorizedError struct{ Field string }

func (e *UnauthorizedError) Error() string { return e.Field + ": " + ErrProviderUnauthorized.Error() }
func (e *UnauthorizedError) Unwrap() error { return ErrProviderUnauthorized }

// Sealer seals values bound to their row (ADR 008).
type Sealer interface {
	Seal(plaintext, associated []byte) ([]byte, error)
	// Open returns an error for a value that another key, row or tampering produced.
	Open(sealed, associated []byte) ([]byte, error)
	NeedsReseal(sealed []byte) bool
}

// Aggregator reads an aggregator application with an integration's credentials and may
// cache one API key per integration. Errors: ErrProviderUnauthorized, ErrItemNotFound, or
// one wrapping ErrProviderUnavailable; none names an identifier (A44).
type Aggregator interface {
	// Verify creates an API key from the credentials, replacing any cached one.
	Verify(ctx context.Context, integrationID uuid.UUID, c domain.Credentials) error
	// Item returns the item as an unsaved connection with its accounts.
	Item(ctx context.Context, integrationID uuid.UUID, c domain.Credentials, itemID string) (domain.Connection, error)
	// Accounts lists the item's external accounts, reserved balances included.
	Accounts(ctx context.Context, integrationID uuid.UUID, c domain.Credentials, itemID string) ([]domain.ExternalAccount, error)
	// ItemState returns the item's status and last update.
	ItemState(ctx context.Context, integrationID uuid.UUID, c domain.Credentials, itemID string) (status string, updatedAt *time.Time, err error)
	// ReadAccount returns an account of the item with its lines dated in [from, to], in minor
	// units of scale; ErrAccountGone when the item no longer lists the account. A reserved balance
	// is found by its identification and read without lines (A74).
	ReadAccount(ctx context.Context, integrationID uuid.UUID, c domain.Credentials, itemID, accountID string, from, to time.Time, scale int) (domain.AccountRead, error)
	Forget(integrationID uuid.UUID)
}

// NameKey pages lists ordered by name.
type NameKey struct {
	Name string    `json:"n"`
	ID   uuid.UUID `json:"i"`
}

func credentialRow(userID int64, id uuid.UUID) []byte {
	return fmt.Appendf(nil, "ingestion_integration|%d|%s", userID, id)
}

func (s *Service) available() error {
	if s.box == nil {
		return ErrIntegrationUnavailable
	}
	return nil
}

func (s *Service) seal(userID int64, id uuid.UUID, c domain.Credentials) ([]byte, error) {
	plain, err := json.Marshal(c)
	if err != nil {
		return nil, err
	}
	return s.box.Seal(plain, credentialRow(userID, id))
}

func (s *Service) credentials(i domain.Integration) (domain.Credentials, error) {
	plain, err := s.box.Open(i.SealedCredentials, credentialRow(i.UserID, i.ID))
	if err != nil {
		return domain.Credentials{}, ErrCredentialsUnreadable
	}
	var c domain.Credentials
	if err := json.Unmarshal(plain, &c); err != nil {
		return domain.Credentials{}, ErrCredentialsUnreadable
	}
	return c, nil
}

func (s *Service) verify(ctx context.Context, id uuid.UUID, c domain.Credentials) error {
	err := s.agg.Verify(ctx, id, c)
	if errors.Is(err, ErrProviderUnauthorized) {
		return &UnauthorizedError{Field: "client_secret"}
	}
	return err
}

// CreateIntegration stores credentials the provider accepts; rejected ones store nothing (S57).
func (s *Service) CreateIntegration(ctx context.Context, userID int64, p domain.Provider, name string, c domain.Credentials) (domain.Integration, error) {
	if err := s.available(); err != nil {
		return domain.Integration{}, err
	}
	i, err := domain.NewIntegration(uuid.Must(uuid.NewV7()), userID, p, name)
	if err != nil {
		return domain.Integration{}, err
	}
	if err := s.verify(ctx, i.ID, c); err != nil {
		return domain.Integration{}, err
	}
	if i.SealedCredentials, err = s.seal(userID, i.ID, c); err != nil {
		s.agg.Forget(i.ID)
		return domain.Integration{}, err
	}
	saved, err := s.repo.InsertIntegration(ctx, i)
	if err != nil {
		s.agg.Forget(i.ID)
	}
	return saved, err
}

func (s *Service) Integration(ctx context.Context, userID int64, id uuid.UUID) (domain.Integration, error) {
	if err := s.available(); err != nil {
		return domain.Integration{}, err
	}
	return s.repo.Integration(ctx, userID, id)
}

func (s *Service) ListIntegrations(ctx context.Context, userID int64, p page.Request[NameKey]) ([]domain.Integration, *NameKey, error) {
	if err := s.available(); err != nil {
		return nil, nil, err
	}
	return s.repo.ListIntegrations(ctx, userID, p)
}

// UpdateCredentials replaces the credentials after the provider accepts them; rejected ones
// leave the stored ones in place.
func (s *Service) UpdateCredentials(ctx context.Context, userID int64, id uuid.UUID, c domain.Credentials) (domain.Integration, error) {
	if err := s.available(); err != nil {
		return domain.Integration{}, err
	}
	if _, err := s.repo.Integration(ctx, userID, id); err != nil {
		return domain.Integration{}, err
	}
	if err := s.verify(ctx, id, c); err != nil {
		s.agg.Forget(id)
		return domain.Integration{}, err
	}
	sealed, err := s.seal(userID, id, c)
	if err != nil {
		return domain.Integration{}, err
	}
	return s.repo.UpdateCredentials(ctx, userID, id, sealed)
}

func (s *Service) DeleteIntegration(ctx context.Context, userID int64, id uuid.UUID) error {
	if err := s.available(); err != nil {
		return err
	}
	if err := s.repo.DeleteIntegration(ctx, userID, id); err != nil {
		return err
	}
	s.agg.Forget(id)
	return nil
}

// RotateSecrets reseals every user's credentials under the current key in one database
// transaction and returns how many changed (ADR 008 K4). A value that opens with neither
// key aborts the rotation.
func (s *Service) RotateSecrets(ctx context.Context) (int, error) {
	if err := s.available(); err != nil {
		return 0, err
	}
	return s.repo.ResealCredentials(ctx, func(userID int64, id uuid.UUID, sealed []byte) ([]byte, error) {
		if !s.box.NeedsReseal(sealed) {
			return nil, nil
		}
		row := credentialRow(userID, id)
		plain, err := s.box.Open(sealed, row)
		if err != nil {
			return nil, fmt.Errorf("integration %s: %w", id, ErrCredentialsUnreadable)
		}
		return s.box.Seal(plain, row)
	})
}
