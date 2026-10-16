package ingestion

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/pluggy"
)

// pluggyPort adapts the Pluggy client to the port app.Aggregator, caching one API key per
// integration (A45).
type pluggyPort struct {
	sessions *pluggy.Sessions
}

func (p pluggyPort) translate(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, pluggy.ErrUnauthorized):
		return app.ErrProviderUnauthorized
	case errors.Is(err, pluggy.ErrNotFound):
		return app.ErrItemNotFound
	}
	return fmt.Errorf("%w: %w", app.ErrProviderUnavailable, err)
}

// session runs fn with the integration's cached API key; a key the provider no longer
// accepts is replaced once.
func (p pluggyPort) session(ctx context.Context, id uuid.UUID, c domain.Credentials, fn func(*pluggy.Session) error) error {
	key := id.String()
	for attempt := 0; ; attempt++ {
		s, err := p.sessions.Get(ctx, key, c.ClientID, c.ClientSecret)
		if err != nil {
			return p.translate(err)
		}
		err = fn(s)
		if !errors.Is(err, pluggy.ErrUnauthorized) || attempt == 1 {
			return p.translate(err)
		}
		p.sessions.Forget(key)
	}
}

func (p pluggyPort) Verify(ctx context.Context, id uuid.UUID, c domain.Credentials) error {
	p.sessions.Forget(id.String())
	return p.session(ctx, id, c, func(*pluggy.Session) error { return nil })
}

func (p pluggyPort) Forget(id uuid.UUID) { p.sessions.Forget(id.String()) }

func (p pluggyPort) Item(ctx context.Context, id uuid.UUID, c domain.Credentials, itemID string) (domain.Connection, error) {
	var out domain.Connection
	err := p.session(ctx, id, c, func(s *pluggy.Session) error {
		it, err := s.Item(ctx, itemID)
		if err != nil {
			return err
		}
		accounts, err := s.Accounts(ctx, itemID)
		if err != nil {
			return err
		}
		out = domain.Connection{Name: it.Connector.Name, ProviderStatus: it.Status}
		if it.LastUpdatedAt != nil {
			at, err := time.Parse(time.RFC3339Nano, *it.LastUpdatedAt)
			if err != nil {
				return errors.New("pluggy GET /items/{id}: lastUpdatedAt is not an RFC 3339 instant")
			}
			out.LastItemUpdateAt = &at
		}
		for _, a := range accounts {
			out.Accounts = append(out.Accounts, domain.ExternalAccount{
				ExternalID: a.ID, Type: a.Type, Subtype: a.Subtype, Name: a.Name,
				NumberLast4: domain.LastDigits(a.Number), Currency: a.CurrencyCode,
			})
		}
		return nil
	})
	return out, err
}
