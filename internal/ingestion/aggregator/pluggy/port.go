package pluggy

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy/client"
	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
)

// Port adapts the Pluggy client to the port app.Aggregator, caching one API key per
// integration (A45).
type Port struct {
	sessions *client.Sessions
}

// DefaultURL is the Pluggy API address used when none is configured.
const DefaultURL = "https://api.pluggy.ai"

// NewPort builds the Pluggy port on hc, which the caller configures not to follow redirects (N17).
func NewPort(baseURL string, hc *http.Client, clk clock.Clock) (*Port, error) {
	if baseURL == "" {
		baseURL = DefaultURL
	}

	c, err := client.NewClient(baseURL, hc, clk.Now)
	if err != nil {
		return nil, err
	}

	return &Port{sessions: client.NewSessions(c)}, nil
}

func (p Port) ID() string { return "pluggy" }

func (p Port) Name() string { return "Pluggy" }

func (p Port) CredentialFields() []domain.CredentialField {
	return []domain.CredentialField{{Name: "client_id"}, {Name: "client_secret", Secret: true}}
}

func (p Port) ConnectMethod() string { return "reference" }

func (p Port) MinSyncInterval() time.Duration { return time.Minute }

func (p Port) Portal() string { return "Meu Pluggy" }

// State maps the statuses that need the owner in Meu Pluggy; the item's data is stale until
// the owner acts (P6 amendment A43).
func (p Port) State(status string) domain.ConnectionState {
	switch status {
	case "LOGIN_ERROR", "OUTDATED", "WAITING_USER_INPUT":
		return domain.StateNeedsOwner
	case "UPDATED":
		return domain.StateOK
	}

	return domain.StateFailed
}

func (p Port) Verify(ctx context.Context, id uuid.UUID, c domain.Credentials) error {
	p.sessions.Forget(id.String())
	return p.session(ctx, id, c, func(*client.Session) error { return nil })
}

func (p Port) ConnectOrigin() string { return "https://connect.pluggy.ai" }

func (p Port) ConnectToken(
	ctx context.Context,
	id uuid.UUID,
	c domain.Credentials,
) (string, error) {
	var out string

	err := p.session(ctx, id, c, func(s *client.Session) error {
		token, err := s.ConnectToken(ctx)
		out = token

		return err
	})

	return out, err
}

func (p Port) Forget(id uuid.UUID) { p.sessions.Forget(id.String()) }

func (p Port) Item(
	ctx context.Context,
	id uuid.UUID,
	c domain.Credentials,
	itemID string,
) (domain.Connection, error) {
	var out domain.Connection
	err := p.session(ctx, id, c, func(s *client.Session) error {
		it, err := s.Item(ctx, itemID)
		if err != nil {
			return err
		}

		accounts, err := s.Accounts(ctx, itemID)
		if err != nil {
			return err
		}

		out = domain.Connection{Name: it.Connector.Name, ProviderStatus: it.Status}
		if out.LastItemUpdateAt, err = updatedAt(it); err != nil {
			return err
		}

		out.Accounts = externalAccounts(accounts)

		return nil
	})

	return out, err
}

func (p Port) Accounts(
	ctx context.Context,
	id uuid.UUID,
	c domain.Credentials,
	itemID string,
) ([]domain.ExternalAccount, error) {
	var out []domain.ExternalAccount

	err := p.session(ctx, id, c, func(s *client.Session) error {
		accounts, err := s.Accounts(ctx, itemID)
		out = externalAccounts(accounts)

		return err
	})
	if errors.Is(err, app.ErrItemNotFound) {
		return nil, fmt.Errorf("%w: the item is gone", app.ErrAggregatorUnavailable)
	}

	return out, err
}

func (p Port) ItemState(
	ctx context.Context,
	id uuid.UUID,
	c domain.Credentials,
	itemID string,
) (app.ItemState, error) {
	var state app.ItemState

	err := p.session(ctx, id, c, func(s *client.Session) error {
		it, err := s.Item(ctx, itemID)
		if err != nil {
			return err
		}

		state.Status = it.Status
		if state.UpdatedAt, err = itemInstant("lastUpdatedAt", it.LastUpdatedAt); err != nil {
			return err
		}

		if state.NextUpdateAt, err = itemInstant("nextAutoSyncAt", it.NextAutoSyncAt); err != nil {
			return err
		}

		state.ConsentExpiresAt, err = itemInstant("consentExpiresAt", it.ConsentExpiresAt)

		return err
	})
	if errors.Is(err, app.ErrItemNotFound) {
		return app.ItemState{}, fmt.Errorf("%w: the item is gone", app.ErrAggregatorUnavailable)
	}

	return state, err
}

func (p Port) ReadAccount(
	ctx context.Context,
	id uuid.UUID,
	c domain.Credentials,
	itemID, accountID string,
	from, to time.Time,
	createdFrom *time.Time,
	scale int,
) (domain.AccountRead, error) {
	var out domain.AccountRead

	err := p.session(ctx, id, c, func(s *client.Session) error {
		it, err := s.Item(ctx, itemID)
		if err != nil {
			return err
		}

		accounts, err := s.Accounts(ctx, itemID)
		if err != nil {
			return err
		}

		i := slices.IndexFunc(accounts, func(a client.Account) bool { return a.ID == accountID })
		if i < 0 {
			return p.readReserve(ctx, it, accounts, accountID, scale, &out)
		}

		a := accounts[i]

		bills, err := readBills(ctx, s, a, scale, &out)
		if err != nil {
			return err
		}

		ts, err := s.Transactions(ctx, a.ID, from, to)
		if err != nil {
			return err
		}

		out.ItemStatus = it.Status
		if out.ItemUpdatedAt, err = updatedAt(it); err != nil {
			return err
		}

		readBalance(ctx, a, scale, &out)
		readLines(ctx, ts, a, bills, scale, &out)

		if createdFrom == nil {
			return nil
		}

		return readCreated(ctx, s, a, bills, *createdFrom, scale, &out)
	})
	if errors.Is(err, app.ErrItemNotFound) {
		return out, fmt.Errorf("%w: the item is gone", app.ErrAggregatorUnavailable)
	}

	return out, err
}

// session runs fn with the integration's cached API key; a key the aggregator no longer
// accepts is replaced once.
func (p Port) session(
	ctx context.Context,
	id uuid.UUID,
	c domain.Credentials,
	fn func(*client.Session) error,
) error {
	key := id.String()
	for attempt := 0; ; attempt++ {
		s, err := p.sessions.Get(ctx, key, c["client_id"], c["client_secret"])
		if err != nil {
			return p.translate(err)
		}

		err = fn(s)
		if !errors.Is(err, client.ErrUnauthorized) || attempt == 1 {
			return p.translate(err)
		}

		p.sessions.Forget(key)
	}
}

func (p Port) translate(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, app.ErrAccountGone):
		return err
	case errors.Is(err, client.ErrUnauthorized):
		return app.ErrAggregatorUnauthorized
	case errors.Is(err, client.ErrNotFound):
		return app.ErrItemNotFound
	}

	return fmt.Errorf("%w: %w", app.ErrAggregatorUnavailable, err)
}

func updatedAt(it client.Item) (*time.Time, error) {
	return itemInstant("lastUpdatedAt", it.LastUpdatedAt)
}

func itemInstant(field string, v *string) (*time.Time, error) {
	if v == nil {
		return nil, nil
	}

	at, err := time.Parse(time.RFC3339Nano, *v)
	if err != nil {
		return nil, fmt.Errorf("pluggy GET /items/{id}: %s is not an RFC 3339 instant", field)
	}

	return &at, nil
}

// readBills reads the bills of a card account into out and returns them by id.
func readBills(
	ctx context.Context,
	s *client.Session,
	a client.Account,
	scale int,
	out *domain.AccountRead,
) (map[string]client.Bill, error) {
	bills := map[string]client.Bill{}
	if a.Subtype == client.SubtypeCard {
		// Bills come from Open Finance connections only; without them lines bill by the cycle.
		bs, err := s.Bills(ctx, a.ID)
		if err != nil && !errors.Is(err, client.ErrNotFound) {
			return nil, err
		}

		for _, b := range bs {
			bills[b.ID] = b
			if bill, err := ReadBill(b, scale, clock.Location(ctx)); err == nil {
				out.Bills = append(out.Bills, bill)
			}
		}
	}

	return bills, nil
}

// readBalance sets the balance of a bank account at the item's last update; out.ItemUpdatedAt
// is final.
func readBalance(ctx context.Context, a client.Account, scale int, out *domain.AccountRead) {
	if a.Subtype != client.SubtypeCard && out.ItemUpdatedAt != nil {
		// A42: the balance holds at the item's last update.
		if amount, err := client.Minor(a.Balance, scale); err == nil {
			l := out.ItemUpdatedAt.In(clock.Location(ctx))
			out.Balance = &domain.Balance{
				Date:   time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, time.UTC),
				Amount: amount,
			}
		}
	}
}

// readLines normalizes the transactions of the window into out.Seen and out.Records.
func readLines(
	ctx context.Context,
	ts []client.Transaction,
	a client.Account,
	bills map[string]client.Bill,
	scale int,
	out *domain.AccountRead,
) {
	for _, t := range ts {
		out.Seen = append(out.Seen, t.ID)
		r, ok, err := Normalize(t, a, bills, scale, clock.Location(ctx))
		// A line whose amount or date cannot be read is left out (A37); the balance
		// assertion then reports the difference.
		if err == nil && ok {
			out.Records = append(out.Records, r)
		}
	}
}

// readCreated normalizes the transactions created since createdFrom into out.Created.
func readCreated(
	ctx context.Context,
	s *client.Session,
	a client.Account,
	bills map[string]client.Bill,
	createdFrom time.Time,
	scale int,
	out *domain.AccountRead,
) error {
	created, err := s.TransactionsCreatedSince(ctx, a.ID, createdFrom)
	if err != nil {
		return err
	}

	for _, t := range created {
		if r, ok, err := Normalize(t, a, bills, scale, clock.Location(ctx)); err == nil && ok {
			out.Created = append(out.Created, r)
		}
	}

	return nil
}
