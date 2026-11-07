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
	ReasonNoRateInWindow   = "no_rate_in_window"
	ReasonPercentUndefined = "percent_undefined"
)

// maxExcludedCategories is the number of category names an Excluded total lists.
const maxExcludedCategories = 3

// Recorded is what the ledger records of a tree of cash in a range (amendment A208 R19): the
// flows that are not yield, the yield credits and the other income and expense postings.
type Recorded struct {
	Flows           []Flow
	Credits         []Credit
	Income, Expense []Categorized
}

// Credit is a yield credited to a tree on a date, in the instrument of the tree; Value is negative
// for a reversal and Postings is the number of tree postings of its transaction.
type Credit struct {
	Date     time.Time
	Value    money.Money
	Postings int
}

// valuedCredit is a Credit valued in the currency of the report.
type valuedCredit struct {
	Date     time.Time
	Amount   int64
	Postings int
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
// and the excluded income and expense of the report. A flow dated on a day without a rate of rates
// moves to the next day with one (R19).
func (s *Service) recordFlows(ctx context.Context, p *period, rates []IndexRate) error {
	rec, err := s.ledger.RecordedYield(ctx, p.booksID, p.ids, p.from.AddDate(0, 0, -1), p.to)
	if err != nil {
		return err
	}

	in := p.report.Opening.Currency()

	if p.flows, err = s.valuedFlows(ctx, rec.Flows, in, p.from); err != nil {
		return err
	}

	moveToRateDays(p.flows, rates)

	if p.credits, err = s.valuedCredits(ctx, rec.Credits, in, p.from.AddDate(0, 0, -1)); err != nil {
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

// valuedCredits values the credits dated on or after from in currency in.
func (s *Service) valuedCredits(ctx context.Context, credits []Credit, in money.Currency, from time.Time) ([]valuedCredit, error) {
	var out []valuedCredit

	for _, c := range credits {
		if c.Date.Before(from) {
			continue
		}

		v, err := s.valueIn(ctx, c.Value, in, c.Date)
		if err != nil {
			return nil, err
		}

		out = append(out, valuedCredit{Date: c.Date, Amount: v.Amount(), Postings: c.Postings})
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

// creditDates lists the distinct dates of the positive yield credits, oldest first; a reversal is
// not a credit date.
func (p period) creditDates() []time.Time {
	var dates []time.Time

	for _, c := range p.credits {
		if c.Amount > 0 {
			dates = append(dates, c.Date)
		}
	}

	slices.SortFunc(dates, time.Time.Compare)

	return slices.CompactFunc(dates, time.Time.Equal)
}

// withinRates keeps the credits dated on or before the day after the last of rates: a credit
// observed on day C pays the rates before C (R20), and the rate of a day is published after it.
func withinRates(credits []time.Time, rates []IndexRate) []time.Time {
	var last time.Time

	for _, r := range rates {
		if r.Date.After(last) {
			last = r.Date
		}
	}

	limit := last.AddDate(0, 0, 1)

	return slices.DeleteFunc(slices.Clone(credits), func(c time.Time) bool { return c.After(limit) })
}

// creditsIn counts the positive credits dated in (after, until], the tree postings they hold and
// sums the yield of every credit of those dates, a reversal included, in minor units.
func (p period) creditsIn(after, until time.Time) (n, postings int, yield int64) {
	for _, c := range p.credits {
		if !c.Date.After(after) || c.Date.After(until) {
			continue
		}

		yield += c.Amount

		if c.Amount > 0 {
			n++
			postings += c.Postings
		}
	}

	return n, postings, yield
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

// moveToRateDays moves in place each flow dated on a day without a rate in rates to the next day
// with one. A flow before the first rate or after the last keeps its date: the index has no
// history there, and a gap that long is not a weekend or a holiday.
func moveToRateDays(flows []ReturnFlow, rates []IndexRate) {
	days := make([]time.Time, len(rates))
	for i, r := range rates {
		days[i] = r.Date
	}

	slices.SortFunc(days, time.Time.Compare)

	for i := range flows {
		at, found := slices.BinarySearchFunc(days, flows[i].Date, time.Time.Compare)
		if !found && at > 0 && at < len(days) {
			flows[i].Date = days[at]
		}
	}
}
