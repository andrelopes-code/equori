package portfolio

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/registry"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// dailyPeriod is the period of an index with one rate per business day (marketdata IndexSummary).
const (
	dailyPeriod   = "day"
	monthlyPeriod = "month"
)

type jurisdictions struct {
	profiles Profiles
	byID     registry.Registry[domain.Jurisdiction]
}

func (j jurisdictions) For(ctx context.Context, booksID int64) (domain.Jurisdiction, error) {
	p, err := j.profiles.Profile(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("read profile: %w", err)
	}

	id, ok := defaultJurisdiction(p.Region)
	if !ok {
		return nil, nil
	}

	return j.byID.Get(id)
}

type ledgerPort struct {
	l  *ledger.Module
	md *marketdata.Module
}

func (p ledgerPort) AccountFacts(ctx context.Context, booksID int64) ([]app.Account, error) {
	facts, err := p.l.AccountFacts(ctx, booksID)

	out := make([]app.Account, len(facts))
	for i, a := range facts {
		out[i] = app.Account{
			ID:            a.ID,
			ParentID:      a.ParentID,
			InstitutionID: a.InstitutionID,
			Class:         a.Class,
			Kind:          a.Kind,
			Instrument:    a.Instrument,
		}
	}

	return out, err
}

func (p ledgerPort) BaseCurrency(ctx context.Context, booksID int64) (money.Currency, error) {
	return p.l.BaseCurrency(ctx, booksID)
}

func (p ledgerPort) Today(ctx context.Context) time.Time { return p.l.Today(ctx) }

func (p ledgerPort) InvestmentFacts(
	ctx context.Context,
	booksID int64,
	brokerageID uuid.UUID,
) (domain.Facts, error) {
	f, err := p.l.InvestmentFacts(ctx, booksID, brokerageID)
	if err != nil {
		return domain.Facts{}, err
	}

	out := domain.Facts{Currency: f.Currency}
	for _, s := range f.Securities {
		in, err := p.md.Instrument(ctx, string(s.Instrument))
		if err != nil {
			return domain.Facts{}, err
		}

		out.Securities = append(
			out.Securities,
			domain.Security{
				AccountID:  s.AccountID,
				Instrument: s.Instrument,
				Type:       in.Type,
				Subtype:    in.Subtype,
				Exchange:   in.Exchange,
			},
		)
	}

	appendActivity(&out, f)

	return out, nil
}

// appendActivity adds the postings, trades and incomes of f to out.
func appendActivity(out *domain.Facts, f ledger.InvestmentFacts) {
	for _, x := range f.Postings {
		out.Postings = append(
			out.Postings,
			domain.Posting{
				AccountID:     x.AccountID,
				TransactionID: x.TransactionID,
				Date:          x.Date,
				Quantity:      x.Quantity,
				Weight:        x.Weight,
			},
		)
	}

	for _, x := range f.Trades {
		out.Trades = append(out.Trades, domain.Trade{
			TransactionID: x.TransactionID, AccountID: x.AccountID, Date: x.Date, Side: x.Side,
			Quantity: x.Quantity, Gross: x.Gross, Fees: x.Fees, Taxes: x.Taxes, Cost: x.Cost,
			DayTradeQuantity: x.DayTradeQuantity, DayTradeCost: x.DayTradeCost,
		})
	}

	for _, x := range f.Incomes {
		out.Incomes = append(
			out.Incomes,
			domain.Income{
				TransactionID: x.TransactionID,
				AccountID:     x.AccountID,
				Date:          x.Date,
				Type:          x.Type,
				Gross:         x.Gross,
				Withheld:      x.Withheld,
			},
		)
	}
}

func (p ledgerPort) ValuedBalance(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	in money.Currency,
) (money.Money, error) {
	c, err := p.l.ValuedBalance(ctx, booksID, accountID, date, in)
	switch {
	case errors.Is(err, ledger.ErrNotFound):
		return money.Money{}, fmt.Errorf("%w: %w", app.ErrNotFound, err)
	case errors.Is(err, ledger.ErrPriceMissing):
		return money.Money{}, fmt.Errorf("%w: %w", app.ErrPriceMissing, err)
	}

	return c.Value, err
}

func (p ledgerPort) RecordedYield(
	ctx context.Context,
	booksID int64,
	accountIDs []uuid.UUID,
	from, to time.Time,
) (app.Recorded, error) {
	r, err := p.l.RecordedYield(ctx, booksID, accountIDs, from, to)
	if errors.Is(err, ledger.ErrNotFound) {
		return app.Recorded{}, fmt.Errorf("%w: %w", app.ErrNotFound, err)
	}

	flows := func(items []ledger.RecordedItem) []app.Flow {
		out := make([]app.Flow, len(items))
		for i, it := range items {
			out[i] = app.Flow{Date: it.Date, Value: it.Value}
		}

		return out
	}

	credits := func(items []ledger.RecordedItem) []app.Credit {
		out := make([]app.Credit, len(items))
		for i, it := range items {
			out[i] = app.Credit{Date: it.Date, Value: it.Value, Postings: it.Postings}
		}

		return out
	}

	categorized := func(items []ledger.RecordedItem) []app.Categorized {
		out := make([]app.Categorized, len(items))
		for i, it := range items {
			out[i] = app.Categorized{Date: it.Date, Category: it.Label, Value: it.Value}
		}

		return out
	}

	return app.Recorded{
		Flows:   flows(r.Flows),
		Credits: credits(r.Credits),
		Income:  categorized(r.Income),
		Expense: categorized(r.Expense),
	}, err
}

func (p ledgerPort) FirstPosting(
	ctx context.Context,
	booksID int64,
	accountIDs []uuid.UUID,
) (time.Time, bool, error) {
	first, found, err := p.l.FirstPosting(ctx, booksID, accountIDs)
	if errors.Is(err, ledger.ErrNotFound) {
		return time.Time{}, false, fmt.Errorf("%w: %w", app.ErrNotFound, err)
	}

	return first, found, err
}

func (p ledgerPort) Balances(
	ctx context.Context,
	booksID int64,
	date time.Time,
) ([]app.AccountBalance, error) {
	bs, err := p.l.Balances(ctx, booksID, date)

	out := make([]app.AccountBalance, len(bs))
	for i, b := range bs {
		out[i] = app.AccountBalance{AccountID: b.AccountID, Amount: b.Amount}
	}

	return out, err
}

func (p ledgerPort) ExternalFlows(
	ctx context.Context,
	booksID int64,
	accountIDs []uuid.UUID,
	from, to time.Time,
) ([]app.Flow, error) {
	fs, err := p.l.ExternalFlows(ctx, booksID, accountIDs, from, to)
	if errors.Is(err, ledger.ErrNotFound) {
		return nil, fmt.Errorf("%w: %w", app.ErrNotFound, err)
	}

	out := make([]app.Flow, len(fs))
	for i, f := range fs {
		out[i] = app.Flow{Date: f.Date, Value: f.Value}
	}

	return out, err
}
