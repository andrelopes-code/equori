// Package app rebuilds and reads the Portfolio derived tables (docs/domain, 4.3.5).
package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/domain"
)

const kindBrokerage = "brokerage"

// averageCostDecimals is the precision of average cost in positions (P8 amendment A71).
const averageCostDecimals = 4

var ErrPriceMissing = errors.New("price missing")

type Account struct {
	ID, ParentID uuid.UUID
	Kind         string
}

// Ledger is read through ledger.Module (ADR 002).
type Ledger interface {
	AccountFacts(ctx context.Context, userID int64) ([]Account, error)
	InvestmentFacts(ctx context.Context, userID int64, brokerageID uuid.UUID) (domain.Facts, error)
	BaseCurrency(ctx context.Context, userID int64) (money.Currency, error)
}

type Price struct {
	Instrument, Quote money.Currency
	Date              time.Time
	Value             money.Rate
	Source            string
}

// MarketData values quantities; Convert returns an error wrapping ErrPriceMissing when no
// price path exists.
type MarketData interface {
	Scale(ctx context.Context, code money.Currency) (int, error)
	Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (money.Money, []Price, error)
}

type Repository interface {
	Replace(ctx context.Context, userID int64, accountIDs []uuid.UUID, r domain.Rebuilt) error
	PositionsAt(ctx context.Context, userID int64, date time.Time) ([]domain.PositionDay, error)
	RealizedResults(ctx context.Context, userID int64, from, to time.Time) ([]domain.RealizedResult, error)
	IncomeEvents(ctx context.Context, userID int64, from, to time.Time) ([]domain.IncomeEvent, error)
}

type Service struct {
	repo   Repository
	ledger Ledger
	md     MarketData
}

func NewService(repo Repository, l Ledger, md MarketData) *Service {
	return &Service{repo: repo, ledger: l, md: md}
}

// WithRepository returns the service over repo, the dispatcher's transaction.
func (s *Service) WithRepository(repo Repository) *Service {
	return &Service{repo: repo, ledger: s.ledger, md: s.md}
}

// HandleTransaction rebuilds every brokerage that has one of accountIDs as a child (A71).
func (s *Service) HandleTransaction(ctx context.Context, userID int64, accountIDs []uuid.UUID) error {
	accounts, err := s.ledger.AccountFacts(ctx, userID)
	if err != nil {
		return err
	}
	byID := make(map[uuid.UUID]Account, len(accounts))
	for _, a := range accounts {
		byID[a.ID] = a
	}
	seen := map[uuid.UUID]bool{}
	for _, id := range accountIDs {
		a, ok := byID[id]
		parent, hasParent := byID[a.ParentID]
		if !ok || a.Kind != kindBrokerage || !hasParent || parent.Kind != kindBrokerage || seen[parent.ID] {
			continue
		}
		seen[parent.ID] = true
		if err := s.rebuild(ctx, userID, parent.ID); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) rebuild(ctx context.Context, userID int64, brokerageID uuid.UUID) error {
	facts, err := s.ledger.InvestmentFacts(ctx, userID, brokerageID)
	if err != nil {
		return err
	}
	ids := make([]uuid.UUID, len(facts.Securities))
	for i, sec := range facts.Securities {
		ids[i] = sec.AccountID
	}
	return s.repo.Replace(ctx, userID, ids, domain.Rebuild(facts))
}

type Position struct {
	AccountID           uuid.UUID
	Instrument          money.Currency
	Quantity, CostBasis money.Money
	AverageCost         money.Rate
	MarketValue         *money.Money
	Prices              []Price
}

// Positions returns the non-empty positions at the end of date in the base currency;
// a position without a price has no market value.
func (s *Service) Positions(ctx context.Context, userID int64, date time.Time) ([]Position, error) {
	base, err := s.ledger.BaseCurrency(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.PositionsAt(ctx, userID, date)
	if err != nil {
		return nil, err
	}
	out := make([]Position, 0, len(rows))
	for _, row := range rows {
		p := Position{AccountID: row.AccountID, Instrument: row.Instrument}
		if p.Quantity, err = s.amount(ctx, row.Quantity, row.Instrument); err != nil {
			return nil, err
		}
		if p.CostBasis, err = money.New(row.CostBasis, base); err != nil {
			return nil, err
		}
		if p.AverageCost, err = money.Quotient(p.CostBasis, p.Quantity, averageCostDecimals); err != nil {
			return nil, err
		}
		value, prices, err := s.md.Convert(ctx, p.Quantity, base, date)
		switch {
		case errors.Is(err, ErrPriceMissing):
		case err != nil:
			return nil, err
		default:
			p.MarketValue, p.Prices = &value, prices
		}
		out = append(out, p)
	}
	return out, nil
}

type Result struct {
	domain.RealizedResult
	QuantityAmount                     money.Money
	CostAmount, Proceeds, ResultAmount money.Money
}

// RealizedResults returns the sales of year in date order.
func (s *Service) RealizedResults(ctx context.Context, userID int64, year int) ([]Result, error) {
	from, to := yearRange(year)
	rows, err := s.repo.RealizedResults(ctx, userID, from, to)
	if err != nil {
		return nil, err
	}
	out := make([]Result, len(rows))
	for i, row := range rows {
		r := Result{RealizedResult: row}
		if r.QuantityAmount, err = s.amount(ctx, row.Quantity, row.Instrument); err != nil {
			return nil, err
		}
		for _, x := range []struct {
			units int64
			dst   *money.Money
		}{{row.Cost, &r.CostAmount}, {row.Proceeds, &r.Proceeds}, {row.Result, &r.ResultAmount}} {
			if *x.dst, err = money.New(x.units, row.Currency); err != nil {
				return nil, err
			}
		}
		out[i] = r
	}
	return out, nil
}

type IncomeEvent struct {
	domain.IncomeEvent
	GrossAmount, WithheldAmount money.Money
}

// IncomeEvents returns the income of year in date order.
func (s *Service) IncomeEvents(ctx context.Context, userID int64, year int) ([]IncomeEvent, error) {
	from, to := yearRange(year)
	rows, err := s.repo.IncomeEvents(ctx, userID, from, to)
	if err != nil {
		return nil, err
	}
	out := make([]IncomeEvent, len(rows))
	for i, row := range rows {
		e := IncomeEvent{IncomeEvent: row}
		if e.GrossAmount, err = money.New(row.Gross, row.Currency); err != nil {
			return nil, err
		}
		if e.WithheldAmount, err = money.New(row.Withheld, row.Currency); err != nil {
			return nil, err
		}
		out[i] = e
	}
	return out, nil
}

func (s *Service) amount(ctx context.Context, units int64, code money.Currency) (money.Money, error) {
	scale, err := s.md.Scale(ctx, code)
	if err != nil {
		return money.Money{}, err
	}
	return money.NewOf(units, code, scale)
}

func yearRange(year int) (time.Time, time.Time) {
	from := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	return from, from.AddDate(1, 0, 0)
}
