package pluggy

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
)

// Port adapts the Pluggy client to the port app.Aggregator, caching one API key per
// integration (A45).
type Port struct {
	sessions *client.Sessions
	// loc is the instance time zone: dates of instants that are not midnight UTC (A37).
	loc *time.Location
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
	return &Port{sessions: client.NewSessions(c), loc: clk.Location()}, nil
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

func (p Port) translate(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, client.ErrUnauthorized):
		return app.ErrAggregatorUnauthorized
	case errors.Is(err, client.ErrNotFound):
		return app.ErrItemNotFound
	}
	return fmt.Errorf("%w: %w", app.ErrAggregatorUnavailable, err)
}

// session runs fn with the integration's cached API key; a key the aggregator no longer
// accepts is replaced once.
func (p Port) session(ctx context.Context, id uuid.UUID, c domain.Credentials, fn func(*client.Session) error) error {
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

func (p Port) Verify(ctx context.Context, id uuid.UUID, c domain.Credentials) error {
	p.sessions.Forget(id.String())
	return p.session(ctx, id, c, func(*client.Session) error { return nil })
}

func (p Port) Forget(id uuid.UUID) { p.sessions.Forget(id.String()) }

func (p Port) Item(ctx context.Context, id uuid.UUID, c domain.Credentials, itemID string) (domain.Connection, error) {
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

func (p Port) Accounts(ctx context.Context, id uuid.UUID, c domain.Credentials, itemID string) ([]domain.ExternalAccount, error) {
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

// externalAccounts lists each account followed by its reserved balances that hold an amount
// in the account's currency (A73). A reserved balance without an identification, or with one
// already listed, is left out: the identification is the external key of the connection.
func externalAccounts(accounts []client.Account) []domain.ExternalAccount {
	var out []domain.ExternalAccount
	seen := map[string]bool{}
	for _, a := range accounts {
		out = append(out, domain.ExternalAccount{
			ExternalID: a.ID, Type: a.Type, Subtype: a.Subtype, Name: a.Name,
			NumberLast4: domain.LastDigits(a.Number), Currency: a.CurrencyCode,
		})
		if a.BankData == nil {
			continue
		}
		for _, r := range a.BankData.ReservedBalances {
			held := slices.ContainsFunc(r.AvailableAmounts, func(x client.ReservedAmount) bool { return x.CurrencyCode == a.CurrencyCode })
			if !held || r.Identification == "" || seen[r.Identification] {
				continue
			}
			seen[r.Identification] = true
			out = append(out, domain.ExternalAccount{
				ExternalID: r.Identification, Type: a.Type, Subtype: client.SubtypeReserve, Name: r.Name, Currency: a.CurrencyCode,
			})
		}
	}
	return out
}

func (p Port) ItemState(ctx context.Context, id uuid.UUID, c domain.Credentials, itemID string) (app.ItemState, error) {
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
		state.NextUpdateAt, err = itemInstant("nextAutoSyncAt", it.NextAutoSyncAt)
		return err
	})
	if errors.Is(err, app.ErrItemNotFound) {
		return app.ItemState{}, fmt.Errorf("%w: the item is gone", app.ErrAggregatorUnavailable)
	}
	return state, err
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

func (p Port) ReadAccount(ctx context.Context, id uuid.UUID, c domain.Credentials, itemID, accountID string, from, to time.Time, scale int) (domain.AccountRead, error) {
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
			return p.readReserve(it, accounts, accountID, scale, &out)
		}
		a := accounts[i]
		bills := map[string]client.Bill{}
		if a.Subtype == client.SubtypeCard {
			// Bills come from Open Finance connections only; without them lines bill by the cycle.
			bs, err := s.Bills(ctx, a.ID)
			if err != nil && !errors.Is(err, client.ErrNotFound) {
				return err
			}
			for _, b := range bs {
				bills[b.ID] = b
				if bill, err := client.ReadBill(b, scale, p.loc); err == nil {
					out.Bills = append(out.Bills, bill)
				}
			}
		}
		ts, err := s.Transactions(ctx, a.ID, from, to)
		if err != nil {
			return err
		}
		out.ItemStatus = it.Status
		if out.ItemUpdatedAt, err = updatedAt(it); err != nil {
			return err
		}
		if a.Subtype != client.SubtypeCard && out.ItemUpdatedAt != nil {
			// A42: the balance holds at the item's last update.
			if amount, err := client.Minor(a.Balance, scale); err == nil {
				l := out.ItemUpdatedAt.In(p.loc)
				out.Balance = &domain.Balance{Date: time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, time.UTC), Amount: amount}
			}
		}
		for _, t := range ts {
			out.Seen = append(out.Seen, t.ID)
			r, ok, err := client.Normalize(t, a, bills, scale, p.loc)
			// A line whose amount or date cannot be read is left out (A37); the balance
			// assertion then reports the difference.
			if err == nil && ok {
				out.Records = append(out.Records, r)
			}
		}
		return nil
	})
	if errors.Is(err, app.ErrItemNotFound) {
		return out, fmt.Errorf("%w: the item is gone", app.ErrAggregatorUnavailable)
	}
	return out, err
}

// readReserve reads a reserved balance by its identification: no lines, and a balance of the
// summed amounts in the parent account's currency at the item's last update (A74).
// ErrAccountGone when no account holds it.
func (p Port) readReserve(it client.Item, accounts []client.Account, identification string, scale int, out *domain.AccountRead) error {
	for _, a := range accounts {
		if a.BankData == nil {
			continue
		}
		for _, r := range a.BankData.ReservedBalances {
			if r.Identification != identification {
				continue
			}
			var err error
			*out = domain.AccountRead{ItemStatus: it.Status}
			if out.ItemUpdatedAt, err = updatedAt(it); err != nil {
				return err
			}
			var (
				total int64
				held  bool
			)
			for _, x := range r.AvailableAmounts {
				if x.CurrencyCode != a.CurrencyCode {
					continue
				}
				amount, err := client.Minor(x.Amount, scale)
				if err != nil {
					held = false
					break
				}
				total += amount
				held = true
			}
			if held && out.ItemUpdatedAt != nil {
				l := out.ItemUpdatedAt.In(p.loc)
				out.Balance = &domain.Balance{Date: time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, time.UTC), Amount: total}
			}
			return nil
		}
	}
	return app.ErrAccountGone
}
