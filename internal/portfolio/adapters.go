package portfolio

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strconv"
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

	return out, nil
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

type marketPort struct {
	md       *marketdata.Module
	profiles Profiles
}

func (p marketPort) Scale(ctx context.Context, code money.Currency) (int, error) {
	in, err := p.md.Instrument(ctx, string(code))
	return in.Scale, err
}

func (p marketPort) InstrumentOf(
	ctx context.Context,
	code money.Currency,
) (app.InstrumentInfo, error) {
	in, err := p.md.Instrument(ctx, string(code))
	return app.InstrumentInfo{Type: in.Type, QuoteCurrency: in.QuoteCurrency}, err
}

func (p marketPort) QuoteState(
	ctx context.Context,
	code money.Currency,
) (first, last *time.Time, stale bool, err error) {
	in, err := p.md.Instrument(ctx, string(code))
	if err != nil {
		return nil, nil, false, err
	}

	cov, err := p.md.Coverage(ctx, in)
	if err != nil {
		return nil, nil, false, err
	}

	return cov.First, cov.Last, cov.Stale, nil
}

func (p marketPort) Convert(
	ctx context.Context,
	q money.Money,
	to money.Currency,
	date time.Time,
) (money.Money, []app.Price, error) {
	c, err := p.md.Convert(ctx, q, to, date)
	if errors.Is(err, marketdata.ErrPriceMissing) {
		return money.Money{}, nil, fmt.Errorf("%w: %w", app.ErrPriceMissing, err)
	}

	if err != nil {
		return money.Money{}, nil, err
	}

	prices := make([]app.Price, len(c.Prices))
	for i, x := range c.Prices {
		prices[i] = app.Price{
			Instrument: x.Instrument,
			Quote:      x.Quote,
			Date:       x.Date,
			Value:      x.Value,
			Source:     x.Source,
		}
	}

	return c.Value, prices, nil
}

func (p marketPort) IndexRates(
	ctx context.Context,
	id string,
	from, to time.Time,
) ([]app.IndexRate, error) {
	return p.rates(ctx, id, dailyPeriod, app.ErrIndexNotDaily, from, to)
}

func (p marketPort) MonthlyRates(
	ctx context.Context,
	id string,
	from, to time.Time,
) ([]app.IndexRate, error) {
	return p.rates(ctx, id, monthlyPeriod, app.ErrIndexNotMonthly, from, to)
}

func (p marketPort) BenchmarkIndex(ctx context.Context, booksID int64) (string, error) {
	l, err := p.profiles.Profile(ctx, booksID)
	if err != nil {
		return "", err
	}

	return defaultBenchmark(l.Region), nil
}

func (p marketPort) YearBasis(index string) int {
	return indexYearBasis(index)
}

func (p marketPort) IndexCurrency(index string) money.Currency {
	return indexCurrency(index)
}

func (p marketPort) InflationIndex(ctx context.Context, booksID int64) (string, error) {
	l, err := p.profiles.Profile(ctx, booksID)
	if err != nil {
		return "", err
	}

	return defaultInflation(l.Region), nil
}

// rates returns the rates of an enabled index of the given period in [from, to], parsed to
// fractions; wrongPeriod is the error for an index of another period.
func (p marketPort) rates(
	ctx context.Context,
	id, period string,
	wrongPeriod error,
	from, to time.Time,
) ([]app.IndexRate, error) {
	indexes, err := p.md.Indexes(ctx)
	if err != nil {
		return nil, err
	}

	i := slices.IndexFunc(indexes, func(x marketdata.IndexSummary) bool { return x.ID == id })
	if i < 0 {
		return nil, app.ErrUnknownIndex
	}

	if indexes[i].Period != period {
		return nil, wrongPeriod
	}

	rates, err := p.md.IndexRates(ctx, id, from, to)
	if err != nil {
		return nil, err
	}

	out := make([]app.IndexRate, len(rates))
	for i, r := range rates {
		v, err := strconv.ParseFloat(r.Rate, 64)
		if err != nil {
			return nil, fmt.Errorf(
				"parse the rate of %s on %s: %w",
				id,
				r.Date.Format(time.DateOnly),
				err,
			)
		}

		out[i] = app.IndexRate{Date: r.Date, Rate: v}
	}

	return out, nil
}
