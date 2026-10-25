// Package app rebuilds and reads the Portfolio derived tables (docs/domain, 4.3.5).
package app

import (
	"context"
	"errors"
	"fmt"
	"slices"
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
	ID, ParentID, InstitutionID uuid.UUID
	Class, Kind                 string
}

// Ledger is read through ledger.Module (ADR 002).
type Ledger interface {
	AccountFacts(ctx context.Context, userID int64) ([]Account, error)
	InvestmentFacts(ctx context.Context, userID int64, brokerageID uuid.UUID) (domain.Facts, error)
	BaseCurrency(ctx context.Context, userID int64) (money.Currency, error)
	// ValuedBalance values the account and its sub-accounts at the end of date in currency in; the
	// error wraps ErrNotFound for an unknown account and ErrPriceMissing for a missing price.
	ValuedBalance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, in money.Currency) (money.Money, error)
	// ExternalFlows takes the accounts as one tree; FirstPosting is the earliest booked date of it.
	ExternalFlows(ctx context.Context, userID int64, accountIDs []uuid.UUID, from, to time.Time) ([]Flow, error)
	FirstPosting(ctx context.Context, userID int64, accountIDs []uuid.UUID) (time.Time, bool, error)
	// Balances is the balance of every asset and liability account at the end of date, each in
	// its own instrument and counting its own postings only.
	Balances(ctx context.Context, userID int64, date time.Time) ([]AccountBalance, error)
}

// Jurisdictions gives the tax jurisdiction of a user; a nil result means none applies.
type Jurisdictions interface {
	For(ctx context.Context, userID int64) (domain.Jurisdiction, error)
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
	// InstrumentOf returns the type and the quotation currency of an instrument; a currency
	// has no quotation currency.
	InstrumentOf(ctx context.Context, code money.Currency) (InstrumentInfo, error)
	Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (money.Money, []Price, error)
}

type Repository interface {
	Replace(ctx context.Context, userID int64, accountIDs []uuid.UUID, r domain.Rebuilt) error
	PositionsAt(ctx context.Context, userID int64, date time.Time) ([]domain.PositionDay, error)
	RealizedResults(ctx context.Context, userID int64, from, to time.Time) ([]domain.RealizedResult, error)
	IncomeEvents(ctx context.Context, userID int64, from, to time.Time) ([]domain.IncomeEvent, error)
	RebuildUsers(ctx context.Context) ([]int64, error)
}

type Service struct {
	repo   Repository
	ledger Ledger
	md     MarketData
	juris  Jurisdictions
}

func NewService(repo Repository, l Ledger, md MarketData, juris Jurisdictions) *Service {
	return &Service{repo: repo, ledger: l, md: md, juris: juris}
}

// WithRepository returns the service over repo, the dispatcher's transaction.
func (s *Service) WithRepository(repo Repository) *Service {
	return &Service{repo: repo, ledger: s.ledger, md: s.md, juris: s.juris}
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

// RebuildAll rebuilds every brokerage of every user that has one or has derived rows (equori portfolio rebuild).
func (s *Service) RebuildAll(ctx context.Context) error {
	users, err := s.repo.RebuildUsers(ctx)
	if err != nil {
		return err
	}
	for _, userID := range users {
		accounts, err := s.ledger.AccountFacts(ctx, userID)
		if err != nil {
			return err
		}
		ids := make([]uuid.UUID, 0, len(accounts))
		for _, a := range accounts {
			if a.Kind == kindBrokerage {
				ids = append(ids, a.ID)
			}
		}
		if err := s.HandleTransaction(ctx, userID, ids); err != nil {
			return err
		}
	}
	return nil
}

// IncomeTypes returns the universal income types plus those of the user's jurisdiction, sorted.
func (s *Service) IncomeTypes(ctx context.Context, userID int64) ([]string, error) {
	j, err := s.juris.For(ctx, userID)
	if err != nil {
		return nil, err
	}
	types := slices.Clone(domain.UniversalIncomeTypes)
	if j != nil {
		types = append(types, j.IncomeTypes()...)
	}
	slices.Sort(types)
	return slices.Compact(types), nil
}

// Subtypes returns the subtypes of an instrument type that the user's jurisdiction knows; none
// when the user has no jurisdiction.
func (s *Service) Subtypes(ctx context.Context, userID int64, instrumentType string) ([]string, error) {
	j, err := s.juris.For(ctx, userID)
	if err != nil || j == nil {
		return []string{}, err
	}
	return j.Subtypes(instrumentType), nil
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
	j, err := s.juris.For(ctx, userID)
	if err != nil {
		return err
	}
	return s.repo.Replace(ctx, userID, ids, domain.Rebuild(facts, j))
}

type Position struct {
	AccountID           uuid.UUID
	Instrument          money.Currency
	Quantity, CostBasis money.Money
	AverageCost         *money.Rate
	MarketValue         *money.Money
	Prices              []Price
}

// Positions returns the non-empty positions at the end of date with the cost in the base currency
// and the market value in in (the base currency by default); a position without a price has no
// market value, and a missing price to in is ErrPriceMissing.
func (s *Service) Positions(ctx context.Context, userID int64, date time.Time, in money.Currency) ([]Position, error) {
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
		if row.Quantity > 0 && row.CostBasis > 0 {
			avg, err := money.Quotient(p.CostBasis, p.Quantity, averageCostDecimals)
			if err != nil {
				return nil, err
			}
			p.AverageCost = &avg
		}
		value, prices, err := s.md.Convert(ctx, p.Quantity, base, date)
		switch {
		case errors.Is(err, ErrPriceMissing):
		case err != nil:
			return nil, err
		default:
			if value.Currency() != in && in != "" {
				var more []Price
				if value, more, err = s.md.Convert(ctx, value, in, date); err != nil {
					return nil, fmt.Errorf("value the position of %s: %w", row.AccountID, err)
				}
				prices = append(prices, more...)
			}
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

// TaxYear returns the tax year that starts in year under the user's jurisdiction: from inclusive,
// to exclusive.
func (s *Service) TaxYear(ctx context.Context, userID int64, year int) (time.Time, time.Time, error) {
	j, err := s.juris.For(ctx, userID)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	if j == nil {
		from, to := domain.CalendarYear(year)
		return from, to, nil
	}
	from, to := j.TaxYear(year)
	return from, to, nil
}

// RealizedResults returns the sales of the tax year that starts in year, in date order.
func (s *Service) RealizedResults(ctx context.Context, userID int64, year int) ([]Result, error) {
	from, to, err := s.TaxYear(ctx, userID, year)
	if err != nil {
		return nil, err
	}
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

// IncomeEvents returns the income of the tax year that starts in year, in date order.
func (s *Service) IncomeEvents(ctx context.Context, userID int64, year int) ([]IncomeEvent, error) {
	from, to, err := s.TaxYear(ctx, userID, year)
	if err != nil {
		return nil, err
	}
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
