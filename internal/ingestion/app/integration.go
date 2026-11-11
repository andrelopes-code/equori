package app

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

var (
	// ErrIntegrationUnavailable: the instance has no EQUORI_SECRET_KEY (ADR 008 K2).
	ErrIntegrationUnavailable = errors.New("integrations need EQUORI_SECRET_KEY")
	ErrCredentialsUnreadable  = fmt.Errorf("%w: the stored credentials do not open with the configured key; enter them again", ErrIntegrationUnavailable)
	ErrIntegrationInUse       = errors.New("the integration has connections")
	ErrAggregatorUnauthorized = errors.New("the aggregator rejected the credentials")
	ErrAggregatorUnavailable  = errors.New("the aggregator did not answer")
	ErrItemNotFound           = errors.New("the aggregator has no such item for these credentials")
	ErrAccountGone            = errors.New("the aggregator no longer lists a mapped account")
)

// UnauthorizedError names the request field whose credentials the aggregator rejected.
type UnauthorizedError struct{ Field string }

func (e *UnauthorizedError) Error() string { return e.Field + ": " + ErrAggregatorUnauthorized.Error() }
func (e *UnauthorizedError) Unwrap() error { return ErrAggregatorUnauthorized }

// NameKey pages lists ordered by name.
type NameKey struct {
	Name string    `json:"n"`
	ID   uuid.UUID `json:"i"`
}

func credentialRow(booksID int64, id uuid.UUID) []byte {
	return fmt.Appendf(nil, "ingestion_integration|%d|%s", booksID, id)
}

func (s *Service) available() error {
	if s.box == nil {
		return ErrIntegrationUnavailable
	}

	return nil
}

func (s *Service) seal(booksID int64, id uuid.UUID, c domain.Credentials) ([]byte, error) {
	plain, err := json.Marshal(c)
	if err != nil {
		return nil, err
	}

	return s.box.Seal(plain, credentialRow(booksID, id))
}

func (s *Service) credentials(i domain.Integration) (domain.Credentials, error) {
	plain, err := s.box.Open(i.SealedCredentials, credentialRow(i.BooksID, i.ID))
	if err != nil {
		return domain.Credentials{}, ErrCredentialsUnreadable
	}

	var c domain.Credentials
	if err := json.Unmarshal(plain, &c); err != nil {
		return domain.Credentials{}, ErrCredentialsUnreadable
	}

	return c, nil
}

// Aggregators lists the aggregators this instance offers, by identifier.
func (s *Service) Aggregators() []Aggregator {
	ids := s.aggs.IDs()

	out := make([]Aggregator, len(ids))
	for i, id := range ids {
		out[i], _ = s.aggs.Get(id)
	}

	return out
}

func (s *Service) aggregator(p domain.AggregatorID) (Aggregator, error) {
	a, err := s.aggs.Get(string(p))
	if err != nil {
		return nil, &domain.FieldError{Field: "aggregator", Message: "is not an aggregator of this instance"}
	}

	return a, nil
}

// secretField names the credential member the aggregator rejected: its last secret field, else "credentials".
func secretField(fields []domain.CredentialField) string {
	name := "credentials"
	for _, f := range fields {
		if f.Secret {
			name = f.Name
		}
	}

	return name
}

func (s *Service) verify(ctx context.Context, agg Aggregator, id uuid.UUID, c domain.Credentials) error {
	if err := c.Validate(agg.CredentialFields()); err != nil {
		return err
	}

	err := agg.Verify(ctx, id, c)
	if errors.Is(err, ErrAggregatorUnauthorized) {
		return &UnauthorizedError{Field: secretField(agg.CredentialFields())}
	}

	return err
}

// CreateIntegration stores credentials the aggregator accepts; rejected ones store nothing (S57).
func (s *Service) CreateIntegration(ctx context.Context, booksID int64, p domain.AggregatorID, name string, c domain.Credentials) (domain.Integration, error) {
	if err := s.available(); err != nil {
		return domain.Integration{}, err
	}

	i, err := domain.NewIntegration(uuid.Must(uuid.NewV7()), booksID, p, name)
	if err != nil {
		return domain.Integration{}, err
	}

	agg, err := s.aggregator(p)
	if err != nil {
		return domain.Integration{}, err
	}

	if err := s.verify(ctx, agg, i.ID, c); err != nil {
		return domain.Integration{}, err
	}

	if i.SealedCredentials, err = s.seal(booksID, i.ID, c); err != nil {
		agg.Forget(i.ID)
		return domain.Integration{}, err
	}

	saved, err := s.repo.InsertIntegration(ctx, i)
	if err != nil {
		agg.Forget(i.ID)
	}

	return saved, err
}

func (s *Service) Integration(ctx context.Context, booksID int64, id uuid.UUID) (domain.Integration, error) {
	if err := s.available(); err != nil {
		return domain.Integration{}, err
	}

	return s.repo.Integration(ctx, booksID, id)
}

func (s *Service) ListIntegrations(ctx context.Context, booksID int64, p page.Request[NameKey]) ([]domain.Integration, *NameKey, error) {
	if err := s.available(); err != nil {
		return nil, nil, err
	}

	return s.repo.ListIntegrations(ctx, booksID, p)
}

// UpdateCredentials replaces the credentials after the aggregator accepts them; rejected ones
// leave the stored ones in place.
func (s *Service) UpdateCredentials(ctx context.Context, booksID int64, id uuid.UUID, c domain.Credentials) (domain.Integration, error) {
	if err := s.available(); err != nil {
		return domain.Integration{}, err
	}

	i, err := s.repo.Integration(ctx, booksID, id)
	if err != nil {
		return domain.Integration{}, err
	}

	agg, err := s.aggregator(i.Aggregator)
	if err != nil {
		return domain.Integration{}, err
	}

	if err := s.verify(ctx, agg, id, c); err != nil {
		agg.Forget(id)
		return domain.Integration{}, err
	}

	sealed, err := s.seal(booksID, id, c)
	if err != nil {
		return domain.Integration{}, err
	}

	return s.repo.UpdateCredentials(ctx, booksID, id, sealed)
}

func (s *Service) DeleteIntegration(ctx context.Context, booksID int64, id uuid.UUID) error {
	if err := s.available(); err != nil {
		return err
	}

	i, err := s.repo.Integration(ctx, booksID, id)
	if err != nil {
		return err
	}

	if err := s.repo.DeleteIntegration(ctx, booksID, id); err != nil {
		return err
	}

	if agg, err := s.aggregator(i.Aggregator); err == nil {
		agg.Forget(id)
	}

	return nil
}

// RotateSecrets reseals every book's credentials under the current key in one database
// transaction and returns how many changed (ADR 008 K4). A value that opens with neither
// key aborts the rotation.
func (s *Service) RotateSecrets(ctx context.Context) (int, error) {
	if err := s.available(); err != nil {
		return 0, err
	}

	return s.repo.ResealCredentials(ctx, func(booksID int64, id uuid.UUID, sealed []byte) ([]byte, error) {
		// An imported integration holds no credential until the owner enters it (export design E2).
		if len(sealed) == 0 || !s.box.NeedsReseal(sealed) {
			return nil, nil
		}

		row := credentialRow(booksID, id)

		plain, err := s.box.Open(sealed, row)
		if err != nil {
			return nil, fmt.Errorf("integration %s: %w", id, ErrCredentialsUnreadable)
		}

		return s.box.Seal(plain, row)
	})
}

// ItemState is what the aggregator reports about an item.
type ItemState struct {
	Status       string
	UpdatedAt    *time.Time
	NextUpdateAt *time.Time
	// ConsentExpiresAt is the consent expiry the aggregator reports; nil when it does not expire.
	ConsentExpiresAt *time.Time
}
