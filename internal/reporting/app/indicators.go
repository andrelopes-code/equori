package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInvalidMonth = errors.New("month after the current month")
	ErrPriceMissing = errors.New("price missing")
)

type IndicatorAccount struct {
	ID                              uuid.UUID
	Class, Kind, Instrument         string
	Interest, ExcludedFromLiquidity bool
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
func (s *Service) Indicators(ctx context.Context, booksID int64, month, today time.Time) (IndicatorReport, error) {
	if s.commitments == nil || s.valuations == nil {
		return IndicatorReport{}, errors.New("indicators: sources not set")
	}

	current := firstOfMonth(today)

	month = firstOfMonth(month)
	if month.After(current) {
		return IndicatorReport{}, ErrInvalidMonth
	}

	base, err := s.repo.BaseCurrency(ctx, booksID)
	if err != nil {
		return IndicatorReport{}, err
	}

	start := month.AddDate(0, -23, 0)
	end := indicatorMonthEnd(month, current, today)

	totals, loans, err := s.indicatorMonthly(ctx, booksID, start, end)
	if err != nil {
		return IndicatorReport{}, err
	}

	sets, err := s.indicatorSets(ctx, booksID, base)
	if err != nil {
		return IndicatorReport{}, err
	}

	firstMonth, err := s.firstPostingMonth(ctx, booksID)
	if err != nil {
		return IndicatorReport{}, err
	}

	facts, err := s.indicatorFacts(ctx, booksID, indicatorInputs{
		sets:    sets,
		base:    base,
		start:   start,
		current: current,
		today:   today,
		totals:  totals,
		loans:   loans,
	})
	if err != nil {
		return IndicatorReport{}, err
	}

	return IndicatorReport{Currency: base, Months: indicatorMonths(facts, firstMonth)}, nil
}

func (s *Service) indicatorMonthly(
	ctx context.Context,
	booksID int64,
	start, end time.Time,
) (map[time.Time]Shares, map[time.Time]int64, error) {
	totals, err := s.cashMonthTotals(ctx, booksID, start, end)
	if err != nil {
		return nil, nil, err
	}

	loans, err := s.repo.LoanPrincipalByMonth(ctx, booksID, start, end)

	return totals, loans, err
}

func (s *Service) firstPostingMonth(ctx context.Context, booksID int64) (time.Time, error) {
	first, ok, err := s.repo.FirstPosting(ctx, booksID)
	if err != nil {
		return time.Time{}, err
	}

	var firstMonth time.Time
	if ok {
		firstMonth = firstOfMonth(first)
	}

	return firstMonth, nil
}

// indicatorInputs holds what the 24 months of facts of Indicators derive from.
type indicatorInputs struct {
	sets           indicatorSets
	base           string
	start, current time.Time
	today          time.Time
	totals         map[time.Time]Shares
	loans          map[time.Time]int64
}

func (s *Service) indicatorFacts(ctx context.Context, booksID int64, in indicatorInputs) ([]MonthFacts, error) {
	facts := make([]MonthFacts, 24)
	for i := range facts {
		m := in.start.AddDate(0, i, 0)

		f := indicatorFlows(in.sets, in.totals[m], m, in.loans[m])
		if i >= 12 {
			end := indicatorMonthEnd(m, in.current, in.today)
			if err := s.indicatorBalances(ctx, booksID, &f, in.sets, in.base, end); err != nil {
				return nil, err
			}
		}

		facts[i] = f
	}

	return facts, nil
}

func (s *Service) indicatorSets(ctx context.Context, booksID int64, base string) (indicatorSets, error) {
	accounts, err := s.repo.IndicatorAccounts(ctx, booksID)
	if err != nil {
		return indicatorSets{}, err
	}

	return classifyIndicatorAccounts(accounts, base), nil
}

type indicatorSets struct {
	income, expense, interest, liquid, liability map[uuid.UUID]bool
}

func indicatorMonthEnd(m, current, today time.Time) time.Time {
	if m.Equal(current) {
		return today
	}

	return m.AddDate(0, 1, -1)
}

func classifyIndicatorAccounts(accounts []IndicatorAccount, base string) indicatorSets {
	sets := indicatorSets{
		income:    map[uuid.UUID]bool{},
		expense:   map[uuid.UUID]bool{},
		interest:  map[uuid.UUID]bool{},
		liquid:    map[uuid.UUID]bool{},
		liability: map[uuid.UUID]bool{},
	}

	for _, a := range accounts {
		inBase := a.Instrument == base
		switch {
		case a.Class == "income" && inBase:
			sets.income[a.ID] = true
		case a.Class == "expense" && inBase:
			sets.expense[a.ID] = true
		case a.Class == "asset" && liquidKinds[a.Kind] && !a.ExcludedFromLiquidity:
			sets.liquid[a.ID] = true
		case a.Class == "liability":
			sets.liability[a.ID] = true
		}

		if a.Interest && inBase {
			sets.interest[a.ID] = true
		}
	}

	return sets
}

func indicatorFlows(sets indicatorSets, shares Shares, m time.Time, loans int64) MonthFacts {
	f := MonthFacts{Month: m, DebtService: loans}
	for id, v := range shares {
		switch {
		case sets.income[id]:
			f.Income -= v
		case sets.expense[id]:
			f.Expense += v
		}

		if sets.interest[id] {
			f.DebtService += v
		}
	}

	return f
}

func (s *Service) indicatorBalances(
	ctx context.Context,
	booksID int64,
	f *MonthFacts,
	sets indicatorSets,
	base string,
	end time.Time,
) error {
	m := f.Month

	values, err := s.valuations.ValuedBalances(ctx, booksID, end)
	if err != nil {
		return err
	}

	for id, v := range values {
		switch {
		case sets.liquid[id]:
			f.Liquid += v.Amount()
		case sets.liability[id]:
			f.Liabilities -= v.Amount()
		}
	}

	c, err := s.commitments.CommittedTotal(ctx, booksID, m)
	if err != nil {
		return err
	}

	if string(c.Currency()) != base {
		return fmt.Errorf("committed of %s in %s, base %s", m.Format("2006-01"), c.Currency(), base)
	}

	f.Committed = c.Amount()

	return nil
}

func firstOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}
