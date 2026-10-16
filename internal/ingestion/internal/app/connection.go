package app

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// CreateConnection reads the item through the integration and stores it with its accounts,
// all pending (A35).
func (s *Service) CreateConnection(ctx context.Context, userID int64, integrationID uuid.UUID, itemID, name string) (domain.Connection, error) {
	if err := s.available(); err != nil {
		return domain.Connection{}, err
	}
	i, err := s.repo.Integration(ctx, userID, integrationID)
	if errors.Is(err, ErrNotFound) {
		return domain.Connection{}, &domain.FieldError{Field: "integration_id", Message: "unknown integration"}
	}
	if err != nil {
		return domain.Connection{}, err
	}
	creds, err := s.credentials(i)
	if err != nil {
		return domain.Connection{}, err
	}
	c, err := s.agg.Item(ctx, i.ID, creds, itemID)
	switch {
	case errors.Is(err, ErrProviderUnauthorized):
		return domain.Connection{}, &UnauthorizedError{Field: "integration_id"}
	case errors.Is(err, ErrItemNotFound):
		return domain.Connection{}, &domain.FieldError{Field: "item_id", Message: "is not an item of this integration's application"}
	case err != nil:
		return domain.Connection{}, err
	}
	if c.Name, err = domain.ConnectionName(name, c.Name); err != nil {
		return domain.Connection{}, err
	}
	c.UserID, c.IntegrationID, c.ItemID = userID, i.ID, itemID
	return s.repo.InsertConnection(ctx, c)
}

func (s *Service) Connection(ctx context.Context, userID int64, id uuid.UUID) (domain.Connection, error) {
	if err := s.available(); err != nil {
		return domain.Connection{}, err
	}
	return s.repo.Connection(ctx, userID, id)
}

func (s *Service) ListConnections(ctx context.Context, userID int64, p page.Request[NameKey]) ([]domain.Connection, *NameKey, error) {
	if err := s.available(); err != nil {
		return nil, nil, err
	}
	return s.repo.ListConnections(ctx, userID, p)
}

func (s *Service) DeleteConnection(ctx context.Context, userID int64, id uuid.UUID) error {
	if err := s.available(); err != nil {
		return err
	}
	return s.repo.DeleteConnection(ctx, userID, id)
}

// MapAccount maps an external account to a ledger account or ignores it (A35).
func (s *Service) MapAccount(ctx context.Context, userID int64, connectionID, externalAccountID uuid.UUID, m domain.Mapping) (domain.ExternalAccount, error) {
	if err := s.available(); err != nil {
		return domain.ExternalAccount{}, err
	}
	c, err := s.repo.Connection(ctx, userID, connectionID)
	if err != nil {
		return domain.ExternalAccount{}, err
	}
	var ext *domain.ExternalAccount
	for i := range c.Accounts {
		if c.Accounts[i].ID == externalAccountID {
			ext = &c.Accounts[i]
		}
	}
	if ext == nil {
		return domain.ExternalAccount{}, ErrNotFound
	}
	if err := m.Validate(); err != nil {
		return domain.ExternalAccount{}, err
	}
	var target domain.ImportTarget
	if !m.Ignored {
		target, err = s.ledger.ImportTarget(ctx, userID, *m.AccountID)
		if errors.Is(err, ErrNotFound) {
			return domain.ExternalAccount{}, &domain.FieldError{Field: "account_id", Message: "unknown account"}
		}
		if err != nil {
			return domain.ExternalAccount{}, err
		}
	}
	mapped, err := ext.Apply(m, target)
	if err != nil {
		return domain.ExternalAccount{}, err
	}
	return s.repo.SaveMapping(ctx, mapped)
}
