package planning

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/planning/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type ledgerPort struct{ l *ledger.Module }

func (p ledgerPort) AccountFacts(ctx context.Context, booksID int64) ([]app.Account, error) {
	facts, err := p.l.AccountFacts(ctx, booksID)

	out := make([]app.Account, len(facts))
	for i, a := range facts {
		out[i] = app.Account{ID: a.ID, ParentID: a.ParentID, Class: a.Class, Kind: a.Kind, Instrument: a.Instrument, Closed: a.ClosedOn != nil}
	}

	return out, err
}

func (p ledgerPort) MissingPayees(ctx context.Context, booksID int64, ids []uuid.UUID) ([]uuid.UUID, error) {
	return p.l.MissingPayees(ctx, booksID, ids)
}

func (p ledgerPort) BaseCurrency(ctx context.Context, booksID int64) (money.Currency, error) {
	return p.l.BaseCurrency(ctx, booksID)
}

func (p ledgerPort) AccountTransactionsBetween(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time) ([]uuid.UUID, error) {
	return p.l.AccountTransactionsBetween(ctx, booksID, accountID, from, to)
}

func (p ledgerPort) TransactionFacts(ctx context.Context, booksID int64, ids []uuid.UUID) ([]domain.Transaction, error) {
	facts, err := p.l.TransactionFacts(ctx, booksID, ids)

	out := make([]domain.Transaction, len(facts))
	for i, f := range facts {
		t := domain.Transaction{ID: f.ID, Date: f.Date, PayeeID: f.PayeeID, Description: f.Description, Voided: f.Voided}
		for _, fp := range f.Postings {
			t.Postings = append(t.Postings, domain.Posting{AccountID: fp.AccountID, Amount: fp.Amount.Amount()})
		}

		out[i] = t
	}

	return out, err
}

func (p ledgerPort) CategoryTotal(ctx context.Context, booksID int64, categoryID uuid.UUID, from, to time.Time) (int64, error) {
	m, err := p.l.CategoryTotal(ctx, booksID, categoryID, from, to)
	return m.Amount(), err
}

func (p ledgerPort) Balance(ctx context.Context, booksID int64, accountID uuid.UUID, date time.Time) (money.Money, error) {
	m, err := p.l.Balance(ctx, booksID, accountID, date)
	if errors.Is(err, ledger.ErrMixedInstruments) {
		return money.Money{}, fmt.Errorf("%w: %w", app.ErrMixedInstruments, err)
	}

	return m, err
}

func (p ledgerPort) ValuedBalance(ctx context.Context, booksID int64, accountID uuid.UUID, date time.Time, in money.Currency) (app.Valuation, error) {
	c, err := p.l.ValuedBalance(ctx, booksID, accountID, date, in)
	if errors.Is(err, ledger.ErrPriceMissing) {
		return app.Valuation{}, fmt.Errorf("%w: %w", app.ErrPriceMissing, err)
	}

	if err != nil {
		return app.Valuation{}, err
	}

	out := app.Valuation{Value: c.Value, Prices: make([]app.Price, len(c.Prices)), Parts: make([]app.ValuedPart, len(c.Parts))}
	for i, x := range c.Prices {
		out.Prices[i] = app.Price{Instrument: x.Instrument, Quote: x.Quote, Date: x.Date, Value: x.Value, Source: x.Source}
	}

	for i, x := range c.Parts {
		out.Parts[i] = app.ValuedPart{AccountID: accountID, Instrument: x.Instrument, Quantity: x.Quantity, Value: x.Value}
	}

	return out, nil
}

func (p ledgerPort) Commitment(ctx context.Context, booksID int64, cardID uuid.UUID, month time.Time) (int64, error) {
	m, err := p.l.Commitment(ctx, booksID, cardID, month)
	return m.Amount(), err
}

func (p ledgerPort) PriorInstallments(ctx context.Context, booksID int64, cardID uuid.UUID, month time.Time) (int64, error) {
	m, err := p.l.PriorInstallments(ctx, booksID, cardID, month)
	return m.Amount(), err
}

func (p ledgerPort) OwnCategoryMonthlyTotals(ctx context.Context, booksID int64, class string, from, to time.Time) (map[uuid.UUID]map[time.Time]int64, error) {
	rows, err := p.l.OwnCategoryMonthlyTotals(ctx, booksID, class, from, to)
	if err != nil {
		return nil, err
	}

	out := make(map[uuid.UUID]map[time.Time]int64)
	for _, r := range rows {
		if out[r.CategoryID] == nil {
			out[r.CategoryID] = make(map[time.Time]int64)
		}

		out[r.CategoryID][r.Month] = r.Total.Amount()
	}

	return out, nil
}

func (p ledgerPort) FirstPosting(ctx context.Context, booksID int64, accountIDs []uuid.UUID) (time.Time, bool, error) {
	return p.l.FirstPosting(ctx, booksID, accountIDs)
}

func (p ledgerPort) CategoryMonthlyTotals(ctx context.Context, booksID int64, categoryID uuid.UUID, from, to time.Time) (map[time.Time]int64, error) {
	ms, err := p.l.CategoryMonthlyTotals(ctx, booksID, categoryID, from, to)

	out := make(map[time.Time]int64, len(ms))
	for m, v := range ms {
		out[m] = v.Amount()
	}

	return out, err
}

type pricesPort struct{ md *marketdata.Module }

func (p pricesPort) Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (money.Money, []app.Price, error) {
	c, err := p.md.Convert(ctx, q, to, date)
	if errors.Is(err, marketdata.ErrPriceMissing) {
		return money.Money{}, nil, fmt.Errorf("%w: %w", app.ErrPriceMissing, err)
	}

	if err != nil {
		return money.Money{}, nil, err
	}

	prices := make([]app.Price, len(c.Prices))
	for i, x := range c.Prices {
		prices[i] = app.Price{Instrument: x.Instrument, Quote: x.Quote, Date: x.Date, Value: x.Value, Source: x.Source}
	}

	return c.Value, prices, nil
}

type calendarPort struct{ md *marketdata.Module }

func (c calendarPort) DefaultCalendar(region string) string { return c.md.DefaultCalendar(region) }

func (c calendarPort) Holidays(ctx context.Context, name string, year int) ([]time.Time, error) {
	hs, err := c.md.Holidays(ctx, name, year)
	if errors.Is(err, marketdata.ErrUnknownCalendar) {
		return nil, fmt.Errorf("%w: %w", app.ErrUnknownCalendar, err)
	}

	out := make([]time.Time, len(hs))
	for i, h := range hs {
		out[i] = h.Date
	}

	return out, err
}

// toolLedger gives the tools the names and instruments of the book's accounts and categories.
type toolLedger struct{ l *ledger.Module }

func (t toolLedger) Accounts(ctx context.Context, booksID int64) (map[uuid.UUID]toolapi.Account, error) {
	accounts, _, err := t.l.CaptureVocabulary(ctx, booksID)
	if err != nil {
		return nil, err
	}

	out := make(map[uuid.UUID]toolapi.Account, len(accounts))
	for _, a := range accounts {
		out[a.ID] = toolapi.Account{Name: a.Name, Instrument: a.Instrument}
	}

	return out, nil
}

func (t toolLedger) PayeeNames(ctx context.Context, booksID int64) (map[uuid.UUID]string, error) {
	_, payees, err := t.l.CaptureVocabulary(ctx, booksID)
	if err != nil {
		return nil, err
	}

	out := make(map[uuid.UUID]string, len(payees))
	for _, p := range payees {
		out[p.ID] = p.Name
	}

	return out, nil
}

func (t toolLedger) Transaction(ctx context.Context, booksID int64, id uuid.UUID) (toolapi.Transaction, bool, error) {
	facts, err := t.l.TransactionFacts(ctx, booksID, []uuid.UUID{id})
	if err != nil || len(facts) == 0 || facts[0].Voided {
		return toolapi.Transaction{}, false, err
	}

	return toolapi.Transaction{Description: facts[0].Description, Date: facts[0].Date}, true, nil
}

func (t toolLedger) BaseCurrency(ctx context.Context, booksID int64) (money.Currency, error) {
	return t.l.BaseCurrency(ctx, booksID)
}
