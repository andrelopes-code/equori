package app

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// CreateConnection reads the item through the integration and stores it with its accounts,
// all pending (A35).
func (s *Service) CreateConnection(ctx context.Context, booksID int64, integrationID uuid.UUID, itemID, name string) (domain.Connection, error) {
	if err := s.available(); err != nil {
		return domain.Connection{}, err
	}

	i, err := s.repo.Integration(ctx, booksID, integrationID)
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

	agg, err := s.aggregator(i.Aggregator)
	if err != nil {
		return domain.Connection{}, err
	}

	c, err := s.fetchItem(ctx, agg, i.ID, creds, itemID)
	if err != nil {
		return domain.Connection{}, err
	}

	if c.Name, err = domain.ConnectionName(name, c.Name); err != nil {
		return domain.Connection{}, err
	}

	c.BooksID, c.IntegrationID, c.ExternalID = booksID, i.ID, itemID

	for i := range c.Accounts {
		withHolderDigest(&c.Accounts[i])
	}

	stored, err := s.repo.InsertConnection(ctx, c)
	if err != nil {
		return domain.Connection{}, err
	}

	stored.State, stored.Portal = agg.State(stored.ProviderStatus), agg.Portal()

	return stored, nil
}

// withState sets the connection's state from the aggregator of its integration; an
// integration whose aggregator this instance no longer offers reads as failed.
func (s *Service) withState(ctx context.Context, c *domain.Connection, aggs map[uuid.UUID]Aggregator) error {
	agg, ok := aggs[c.IntegrationID]
	if !ok {
		i, err := s.repo.Integration(ctx, c.BooksID, c.IntegrationID)
		if err != nil {
			return err
		}

		agg, _ = s.aggregator(i.Aggregator)
		aggs[c.IntegrationID] = agg
	}

	if agg == nil {
		c.State = domain.StateFailed
		return nil
	}

	c.State, c.Portal = c.StateAt(agg.State(c.ProviderStatus), s.now()), agg.Portal()

	return nil
}

func (s *Service) Connection(ctx context.Context, booksID int64, id uuid.UUID) (domain.Connection, error) {
	if err := s.available(); err != nil {
		return domain.Connection{}, err
	}

	c, err := s.repo.Connection(ctx, booksID, id)
	if err != nil {
		return domain.Connection{}, err
	}

	return c, s.withState(ctx, &c, map[uuid.UUID]Aggregator{})
}

func (s *Service) ListConnections(ctx context.Context, booksID int64, p page.Request[NameKey]) ([]domain.Connection, *NameKey, error) {
	if err := s.available(); err != nil {
		return nil, nil, err
	}

	list, next, err := s.repo.ListConnections(ctx, booksID, p)
	if err != nil {
		return nil, nil, err
	}

	aggs := map[uuid.UUID]Aggregator{}
	for i := range list {
		if err := s.withState(ctx, &list[i], aggs); err != nil {
			return nil, nil, err
		}
	}

	return list, next, nil
}

func (s *Service) DeleteConnection(ctx context.Context, booksID int64, id uuid.UUID) error {
	if err := s.available(); err != nil {
		return err
	}

	return s.repo.DeleteConnection(ctx, booksID, id)
}

// MapAccount maps an external account to a ledger account or ignores it (A35).
func (s *Service) MapAccount(ctx context.Context, booksID int64, connectionID, externalAccountID uuid.UUID, m domain.Mapping) (domain.ExternalAccount, error) {
	if err := s.available(); err != nil {
		return domain.ExternalAccount{}, err
	}

	c, err := s.repo.Connection(ctx, booksID, connectionID)
	if err != nil {
		return domain.ExternalAccount{}, err
	}

	ext := findExternal(c.Accounts, externalAccountID)
	if ext == nil {
		return domain.ExternalAccount{}, ErrNotFound
	}

	if err := m.Validate(); err != nil {
		return domain.ExternalAccount{}, err
	}

	target, err := s.mappingTarget(ctx, booksID, m)
	if err != nil {
		return domain.ExternalAccount{}, err
	}

	mapped, err := ext.Apply(m, target)
	if err != nil {
		return domain.ExternalAccount{}, err
	}

	if !m.Ignored {
		// A214: a ledger account fed by an account the item stopped listing passes to this one.
		for _, held := range c.Accounts {
			if held.ID == ext.ID || held.GoneSince == nil || held.AccountID == nil || *held.AccountID != *m.AccountID {
				continue
			}

			released, err := held.Apply(domain.Mapping{Ignored: true}, domain.ImportTarget{})
			if err != nil {
				return domain.ExternalAccount{}, err
			}

			return s.repo.ReplaceMapping(ctx, released, mapped)
		}
	}

	return s.repo.SaveMapping(ctx, mapped)
}

func findExternal(accounts []domain.ExternalAccount, id uuid.UUID) *domain.ExternalAccount {
	var ext *domain.ExternalAccount
	for i := range accounts {
		if accounts[i].ID == id {
			ext = &accounts[i]
		}
	}

	return ext
}

func (s *Service) mappingTarget(
	ctx context.Context,
	booksID int64,
	m domain.Mapping,
) (domain.ImportTarget, error) {
	var target domain.ImportTarget

	if !m.Ignored {
		var err error

		target, err = s.ledger.ImportTarget(ctx, booksID, *m.AccountID)
		if errors.Is(err, ErrNotFound) {
			return domain.ImportTarget{}, &domain.FieldError{Field: "account_id", Message: "unknown account"}
		}

		if err != nil {
			return domain.ImportTarget{}, err
		}
	}

	return target, nil
}

func (s *Service) fetchItem(
	ctx context.Context,
	agg Aggregator,
	integrationID uuid.UUID,
	creds domain.Credentials,
	itemID string,
) (domain.Connection, error) {
	c, err := agg.Item(ctx, integrationID, creds, itemID)
	switch {
	case errors.Is(err, ErrAggregatorUnauthorized):
		return domain.Connection{}, &UnauthorizedError{Field: "integration_id"}
	case errors.Is(err, ErrItemNotFound):
		return domain.Connection{}, &domain.FieldError{Field: "external_id", Message: "is not an item of this integration's application"}
	case err != nil:
		return domain.Connection{}, err
	}

	return c, nil
}
