package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

var (
	ErrInvalidMonth = errors.New("month after the current month")
	ErrPriceMissing = errors.New("price missing")
)

// Commitments is the committed amount of a month (planning, A57).
type Commitments interface {
	CommittedTotal(ctx context.Context, userID int64, month time.Time) (money.Money, error)
}

// Valuations values each account's own balance at the end of a date in the base currency.
type Valuations interface {
	ValuedBalances(ctx context.Context, userID int64, date time.Time) (map[uuid.UUID]money.Money, error)
}

type IndicatorAccount struct {
	ID                              uuid.UUID
	Class, Kind, Instrument         string
	Interest, ExcludedFromLiquidity bool
}

type IndicatorRepository interface {
	BaseCurrency(ctx context.Context, userID int64) (string, error)
	// FirstPosting is the earliest booked date of the user's postings that are not voided; ok is false without one.
	FirstPosting(ctx context.Context, userID int64) (first time.Time, ok bool, err error)
	IndicatorAccounts(ctx context.Context, userID int64) ([]IndicatorAccount, error)
	// OffCardMonthTotals is OffCardTotals per month, keyed by the first day of the month.
	OffCardMonthTotals(ctx context.Context, userID int64, from, to time.Time) (map[time.Time]Shares, error)
	LoanPrincipalByMonth(ctx context.Context, userID int64, from, to time.Time) (map[time.Time]int64, error)
}

type IndicatorReport struct {
	Currency string
	Months   []IndicatorMonth
}

// liquidKinds are the asset kinds the liquidity indicator counts (analytics design 4.1).
var liquidKinds = map[string]bool{"checking": true, "savings": true, "cash": true, "wallet": true, "reserve": true}

// UseIndicatorSources sets the late-bound sources of Indicators.
func (s *Service) UseIndicatorSources(c Commitments, v Valuations) {
	s.commitments, s.valuations = c, v
}

// Indicators returns the indicators of month and the 11 months before it in the cash view
// (analytics design 4); today bounds the current month.
func (s *Service) Indicators(ctx context.Context, userID int64, month, today time.Time) (IndicatorReport, error) {
	if s.commitments == nil || s.valuations == nil {
		return IndicatorReport{}, errors.New("indicators: sources not set")
	}
	current := firstOfMonth(today)
	month = firstOfMonth(month)
	if month.After(current) {
		return IndicatorReport{}, ErrInvalidMonth
	}
	base, err := s.repo.BaseCurrency(ctx, userID)
	if err != nil {
		return IndicatorReport{}, err
	}
	monthEnd := func(m time.Time) time.Time {
		if m.Equal(current) {
			return today
		}
		return m.AddDate(0, 1, -1)
	}
	start := month.AddDate(0, -23, 0)
	totals, err := s.cashMonthTotals(ctx, userID, start, monthEnd(month))
	if err != nil {
		return IndicatorReport{}, err
	}
	loans, err := s.repo.LoanPrincipalByMonth(ctx, userID, start, monthEnd(month))
	if err != nil {
		return IndicatorReport{}, err
	}
	accounts, err := s.repo.IndicatorAccounts(ctx, userID)
	if err != nil {
		return IndicatorReport{}, err
	}
	first, ok, err := s.repo.FirstPosting(ctx, userID)
	if err != nil {
		return IndicatorReport{}, err
	}
	var firstMonth time.Time
	if ok {
		firstMonth = firstOfMonth(first)
	}

	income, expense, interest, liquid, liability := map[uuid.UUID]bool{}, map[uuid.UUID]bool{}, map[uuid.UUID]bool{}, map[uuid.UUID]bool{}, map[uuid.UUID]bool{}
	for _, a := range accounts {
		inBase := a.Instrument == base
		switch {
		case a.Class == "income" && inBase:
			income[a.ID] = true
		case a.Class == "expense" && inBase:
			expense[a.ID] = true
		case a.Class == "asset" && liquidKinds[a.Kind] && !a.ExcludedFromLiquidity:
			liquid[a.ID] = true
		case a.Class == "liability":
			liability[a.ID] = true
		}
		if a.Interest && inBase {
			interest[a.ID] = true
		}
	}

	facts := make([]MonthFacts, 24)
	for i := range facts {
		m := start.AddDate(0, i, 0)
		shares := totals[m]
		f := MonthFacts{Month: m, DebtService: loans[m]}
		for id, v := range shares {
			switch {
			case income[id]:
				f.Income -= v
			case expense[id]:
				f.Expense += v
			}
			if interest[id] {
				f.DebtService += v
			}
		}
		if i >= 12 {
			values, err := s.valuations.ValuedBalances(ctx, userID, monthEnd(m))
			if err != nil {
				return IndicatorReport{}, err
			}
			for id, v := range values {
				switch {
				case liquid[id]:
					f.Liquid += v.Amount()
				case liability[id]:
					f.Liabilities -= v.Amount()
				}
			}
			c, err := s.commitments.CommittedTotal(ctx, userID, m)
			if err != nil {
				return IndicatorReport{}, err
			}
			if string(c.Currency()) != base {
				return IndicatorReport{}, fmt.Errorf("committed of %s in %s, base %s", m.Format("2006-01"), c.Currency(), base)
			}
			f.Committed = c.Amount()
		}
		facts[i] = f
	}
	return IndicatorReport{Currency: base, Months: indicatorMonths(facts, firstMonth)}, nil
}

func firstOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}
