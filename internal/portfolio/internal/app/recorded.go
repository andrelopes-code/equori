package app

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Reasons a benchmark or its percent is absent (amendment A208 R23).
const (
	ReasonNoIndexForRegion = "no_index_for_region"
	ReasonCurrencyMismatch = "currency_mismatch"
	ReasonNothingHeld      = "nothing_held"
	ReasonNoYieldRecorded  = "no_yield_recorded"
	ReasonSingleCredit     = "single_credit"
	ReasonTooSmall         = "too_small"
)

// maxExcludedCategories is the number of category names an Excluded total lists.
const maxExcludedCategories = 3

// Recorded is what the ledger records of a tree of cash in a range (amendment A208 R19): the
// flows that are not yield, the yield credits and the other income and expense postings.
type Recorded struct {
	Flows, Credits  []Flow
	Income, Expense []Categorized
}

// Categorized is an income or expense posting of a tree's transaction, in the balancing currency
// of its transaction.
type Categorized struct {
	Date     time.Time
	Category string
	Value    money.Money
}

// Excluded is the income and the expense of a period that the comparison treated as flows, not as
// yield (amendment A208 R19); a total is nil when there is none.
type Excluded struct {
	Income, Expense *ExcludedTotal
}

// ExcludedTotal is an amount, positive for both income and expense, and the names of the
// categories that hold most of it.
type ExcludedTotal struct {
	Amount     money.Money
	Categories []string
}

// recordFlows sets on p the flows of R19 in place of the flows of section 4.3, the yield credits,
// and the excluded income and expense of the report.
func (s *Service) recordFlows(ctx context.Context, p *period) error {
	rec, err := s.ledger.RecordedYield(ctx, p.booksID, p.ids, p.from.AddDate(0, 0, -1), p.to)
	if err != nil {
		return err
	}

	in := p.report.Opening.Currency()

	if p.flows, err = s.valuedFlows(ctx, rec.Flows, in, p.from); err != nil {
		return err
	}

	if p.credits, err = s.valuedFlows(ctx, rec.Credits, in, p.from.AddDate(0, 0, -1)); err != nil {
		return err
	}

	income, err := s.excludedTotal(ctx, rec.Income, in, p.from, -1)
	if err != nil {
		return err
	}

	expense, err := s.excludedTotal(ctx, rec.Expense, in, p.from, 1)
	if err != nil {
		return err
	}

	if income != nil || expense != nil {
		p.report.Excluded = &Excluded{Income: income, Expense: expense}
	}

	return nil
}

// valuedFlows values the flows dated on or after from in currency in.
func (s *Service) valuedFlows(ctx context.Context, flows []Flow, in money.Currency, from time.Time) ([]ReturnFlow, error) {
	var out []ReturnFlow

	for _, f := range flows {
		if f.Date.Before(from) {
			continue
		}

		v, err := s.valueIn(ctx, f.Value, in, f.Date)
		if err != nil {
			return nil, err
		}

		out = append(out, ReturnFlow{Date: f.Date, Amount: v})
	}

	return out, nil
}

// excludedTotal sums items dated on or after from in currency in, times sign, and names the
// largest categories.
func (s *Service) excludedTotal(ctx context.Context, items []Categorized, in money.Currency, from time.Time, sign int64) (*ExcludedTotal, error) {
	byCategory := map[string]int64{}

	var sum int64

	for _, it := range items {
		if it.Date.Before(from) {
			continue
		}

		v, err := s.valueIn(ctx, it.Value, in, it.Date)
		if err != nil {
			return nil, err
		}

		byCategory[it.Category] += sign * v.Amount()
		sum += sign * v.Amount()
	}

	if len(byCategory) == 0 {
		return nil, nil
	}

	names := make([]string, 0, len(byCategory))
	for name := range byCategory {
		names = append(names, name)
	}

	slices.SortFunc(names, func(a, b string) int {
		return cmp.Or(cmp.Compare(byCategory[b], byCategory[a]), cmp.Compare(a, b))
	})

	total, err := money.New(sum, in)
	if err != nil {
		return nil, fmt.Errorf("total of the excluded: %w", err)
	}

	return &ExcludedTotal{Amount: total, Categories: names[:min(maxExcludedCategories, len(names))]}, nil
}

// valueIn converts value to currency in at the price of date.
func (s *Service) valueIn(ctx context.Context, value money.Money, in money.Currency, date time.Time) (money.Money, error) {
	if value.Currency() == in {
		return value, nil
	}

	v, _, err := s.md.Convert(ctx, value, in, date)
	if err != nil {
		return money.Money{}, fmt.Errorf("value the flow of %s: %w", date.Format(time.DateOnly), err)
	}

	return v, nil
}

// creditDates lists the distinct dates of the yield credits, oldest first.
func (p period) creditDates() []time.Time {
	dates := make([]time.Time, len(p.credits))
	for i, c := range p.credits {
		dates[i] = c.Date
	}

	slices.SortFunc(dates, time.Time.Compare)

	return slices.CompactFunc(dates, time.Time.Equal)
}

// creditsIn counts the credits dated in (after, until] and sums their yield in minor units.
func (p period) creditsIn(after, until time.Time) (n int, yield int64) {
	for _, c := range p.credits {
		if c.Date.After(after) && !c.Date.After(until) {
			n++
			yield += c.Amount.Amount()
		}
	}

	return n, yield
}

// unavailable records the first reason a benchmark or its percent is absent.
func (p period) unavailable(reason string) {
	if p.report.UnavailableReason == "" {
		p.report.UnavailableReason = reason
	}
}

// flowDates lists the dates of the flows of the comparison.
func (p period) flowDates() []time.Time {
	dates := make([]time.Time, len(p.flows))
	for i, f := range p.flows {
		dates[i] = f.Date
	}

	return dates
}
