package ingestion

import (
	"context"
	"errors"
	"fmt"
	"slices"
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
	// loc is the instance time zone: dates of instants that are not midnight UTC (A37).
	loc *time.Location
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
		if out.LastItemUpdateAt, err = updatedAt(it); err != nil {
			return err
		}
		out.Accounts = externalAccounts(accounts)
		return nil
	})
	return out, err
}

func (p pluggyPort) Accounts(ctx context.Context, id uuid.UUID, c domain.Credentials, itemID string) ([]domain.ExternalAccount, error) {
	var out []domain.ExternalAccount
	err := p.session(ctx, id, c, func(s *pluggy.Session) error {
		accounts, err := s.Accounts(ctx, itemID)
		out = externalAccounts(accounts)
		return err
	})
	if errors.Is(err, app.ErrItemNotFound) {
		return nil, fmt.Errorf("%w: the item is gone", app.ErrProviderUnavailable)
	}
	return out, err
}

// externalAccounts lists each account followed by its reserved balances that hold an amount
// in the account's currency (A73). A reserved balance without an identification, or with one
// already listed, is left out: the identification is the external key of the connection.
func externalAccounts(accounts []pluggy.Account) []domain.ExternalAccount {
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
			held := slices.ContainsFunc(r.AvailableAmounts, func(x pluggy.ReservedAmount) bool { return x.CurrencyCode == a.CurrencyCode })
			if !held || r.Identification == "" || seen[r.Identification] {
				continue
			}
			seen[r.Identification] = true
			out = append(out, domain.ExternalAccount{
				ExternalID: r.Identification, Type: a.Type, Subtype: pluggy.SubtypeReserve, Name: r.Name, Currency: a.CurrencyCode,
			})
		}
	}
	return out
}

func (p pluggyPort) ItemState(ctx context.Context, id uuid.UUID, c domain.Credentials, itemID string) (string, *time.Time, error) {
	var (
		status string
		at     *time.Time
	)
	err := p.session(ctx, id, c, func(s *pluggy.Session) error {
		it, err := s.Item(ctx, itemID)
		if err != nil {
			return err
		}
		status = it.Status
		at, err = updatedAt(it)
		return err
	})
	if errors.Is(err, app.ErrItemNotFound) {
		return "", nil, fmt.Errorf("%w: the item is gone", app.ErrProviderUnavailable)
	}
	return status, at, err
}

func updatedAt(it pluggy.Item) (*time.Time, error) {
	if it.LastUpdatedAt == nil {
		return nil, nil
	}
	at, err := time.Parse(time.RFC3339Nano, *it.LastUpdatedAt)
	if err != nil {
		return nil, errors.New("pluggy GET /items/{id}: lastUpdatedAt is not an RFC 3339 instant")
	}
	return &at, nil
}

func (p pluggyPort) ReadAccount(ctx context.Context, id uuid.UUID, c domain.Credentials, itemID, accountID string, from, to time.Time, scale int) (domain.AccountRead, error) {
	var out domain.AccountRead
	err := p.session(ctx, id, c, func(s *pluggy.Session) error {
		it, err := s.Item(ctx, itemID)
		if err != nil {
			return err
		}
		accounts, err := s.Accounts(ctx, itemID)
		if err != nil {
			return err
		}
		i := slices.IndexFunc(accounts, func(a pluggy.Account) bool { return a.ID == accountID })
		if i < 0 {
			return p.readReserve(it, accounts, accountID, scale, &out)
		}
		a := accounts[i]
		bills := map[string]pluggy.Bill{}
		if a.Subtype == pluggy.SubtypeCard {
			// Bills come from Open Finance connections only; without them lines bill by the cycle.
			bs, err := s.Bills(ctx, a.ID)
			if err != nil && !errors.Is(err, pluggy.ErrNotFound) {
				return err
			}
			for _, b := range bs {
				bills[b.ID] = b
			}
		}
		ts, err := s.Transactions(ctx, a.ID, from, to)
		if err != nil {
			return err
		}
		out = domain.AccountRead{ItemStatus: it.Status}
		if out.ItemUpdatedAt, err = updatedAt(it); err != nil {
			return err
		}
		if a.Subtype != pluggy.SubtypeCard && out.ItemUpdatedAt != nil {
			// A42: the balance holds at the item's last update.
			if amount, err := pluggy.Minor(a.Balance, scale); err == nil {
				l := out.ItemUpdatedAt.In(p.loc)
				out.Balance = &domain.Balance{Date: time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, time.UTC), Amount: amount}
			}
		}
		for _, t := range ts {
			out.Seen = append(out.Seen, t.ID)
			r, ok, err := pluggy.Normalize(t, a, bills, scale, p.loc)
			// A line whose amount or date cannot be read is left out (A37); the balance
			// assertion then reports the difference.
			if err == nil && ok {
				out.Records = append(out.Records, r)
			}
		}
		return nil
	})
	if errors.Is(err, app.ErrItemNotFound) {
		return out, fmt.Errorf("%w: the item is gone", app.ErrProviderUnavailable)
	}
	return out, err
}

// readReserve reads a reserved balance by its identification: no lines, and a balance of the
// summed amounts in the parent account's currency at the item's last update (A74).
// ErrAccountGone when no account holds it.
func (p pluggyPort) readReserve(it pluggy.Item, accounts []pluggy.Account, identification string, scale int, out *domain.AccountRead) error {
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
				amount, err := pluggy.Minor(x.Amount, scale)
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
