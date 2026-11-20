package app

import (
	"cmp"
	"context"
	"errors"
	"maps"
	"slices"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// staleDays is the age past which the price of a year end no longer measures it (attribution AT5).
const staleDays = 14

// AttributionYear splits the money result of the portfolio in a calendar year into the result of
// each instrument (docs/specs/2026-11-20-portfolio-attribution-design.md). Missing is non-nil
// when the year could not be valued (AT6); Result, Other and Items are then empty.
type AttributionYear struct {
	Year     int
	From, To time.Time
	Missing  []money.Currency
	Result   *money.Money
	PeriodBP *int
	Other    *money.Money
	Items    []AttributionItem
}

// AttributionItem is the result of one instrument in a year; ReturnBP is nil under AT4 and AT5,
// StaleSince is the date of the old price under AT5.
type AttributionItem struct {
	Instrument money.Currency
	Result     money.Money
	ReturnBP   *int
	StaleSince *time.Time
}

// attributionRow gathers the holdings of one instrument in a year.
type attributionRow struct {
	startValue, endValue int64
	startCost, endCost   int64
	realized, income     int64
	flows                []domain.CashFlow
	staleSince           *time.Time
}

// Attribution returns one AttributionYear per calendar year from the first posting of the
// brokerage trees to today of the book, oldest first (AT1).
func (s *Service) Attribution(ctx context.Context, booksID int64) ([]AttributionYear, error) {
	roots, err := s.brokerageRoots(ctx, booksID)
	if err != nil || len(roots) == 0 {
		return []AttributionYear{}, err
	}

	first, found, err := s.ledger.FirstPosting(ctx, booksID, roots)
	if err != nil || !found {
		return []AttributionYear{}, err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return nil, err
	}

	facts, err := s.holdingFacts(ctx, booksID)
	if err != nil {
		return nil, err
	}

	today := s.ledger.Today(ctx)

	return s.attributionYears(ctx, booksID, facts, base, first.Year(), today)
}

// attributionYears measures the years from first to today's, each in its own goroutine: the
// years share no state, and a book of six years answers in the time of its longest one.
func (s *Service) attributionYears(
	ctx context.Context,
	booksID int64,
	facts []domain.Facts,
	base money.Currency,
	first int,
	today time.Time,
) ([]AttributionYear, error) {
	n := today.Year() - first + 1
	years := make([]AttributionYear, n)
	measured := make([]bool, n)
	errs := make([]error, n)

	var wg sync.WaitGroup
	for i := range n {
		wg.Go(func() {
			years[i], measured[i], errs[i] = s.attributionYear(
				ctx, booksID, facts, base, first+i, today,
			)
		})
	}

	wg.Wait()

	if err := errors.Join(errs...); err != nil {
		return nil, err
	}

	out := []AttributionYear{}
	for i, y := range years {
		if measured[i] {
			out = append(out, y)
		}
	}

	return out, nil
}

// holdingFacts reads the facts of every brokerage that holds a security account.
func (s *Service) holdingFacts(ctx context.Context, booksID int64) ([]domain.Facts, error) {
	accounts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return nil, err
	}

	byID := make(map[uuid.UUID]Account, len(accounts))
	for _, a := range accounts {
		byID[a.ID] = a
	}

	var out []domain.Facts

	seen := map[uuid.UUID]bool{}
	for _, a := range accounts {
		parent, ok := byID[a.ParentID]
		if a.Kind != kindBrokerage || !ok || parent.Kind != kindBrokerage || seen[parent.ID] {
			continue
		}

		seen[parent.ID] = true

		f, err := s.ledger.InvestmentFacts(ctx, booksID, parent.ID)
		if err != nil {
			return nil, err
		}

		out = append(out, f)
	}

	return out, nil
}

// attributionYear measures year up to today; ok is false when no money was invested in it.
func (s *Service) attributionYear(
	ctx context.Context,
	booksID int64,
	facts []domain.Facts,
	base money.Currency,
	year int,
	today time.Time,
) (AttributionYear, bool, error) {
	from := time.Date(year, time.January, 1, 0, 0, 0, 0, time.UTC)

	to := time.Date(year, time.December, 31, 0, 0, 0, 0, time.UTC)
	if today.Before(to) {
		to = today
	}

	start := from.AddDate(0, 0, -1)
	out := AttributionYear{Year: year, From: from, To: to}

	rows, missing, err := s.attributionRows(ctx, facts, base, start, to)
	if err != nil {
		return AttributionYear{}, false, err
	}

	if len(missing) > 0 {
		out.Missing = missing
		return out, true, nil
	}

	report, err := s.Return(ctx, booksID, uuid.Nil, from, to, base, "")
	switch {
	case errors.Is(err, ErrReturnUndefined):
		return AttributionYear{}, false, nil
	case errors.Is(err, ErrPriceMissing):
		out.Missing = []money.Currency{}
		return out, true, nil
	case err != nil:
		return AttributionYear{}, false, err
	}

	if err := fillAttribution(&out, report, rows, base, start); err != nil {
		return AttributionYear{}, false, err
	}

	return out, true, nil
}

// attributionRows values the holdings of each instrument at both ends of (start, end]; missing
// lists the instruments without a price at an end (AT6).
func (s *Service) attributionRows(
	ctx context.Context,
	facts []domain.Facts,
	base money.Currency,
	start, end time.Time,
) (map[money.Currency]*attributionRow, []money.Currency, error) {
	var periods []domain.HoldingPeriod
	for _, f := range facts {
		for _, p := range domain.HoldingPeriods(f, start, end) {
			if p.Active() {
				periods = append(periods, p)
			}
		}
	}

	s.warm(ctx, end, heldCodes(periods))

	rows := map[money.Currency]*attributionRow{}
	missing := map[money.Currency]bool{}

	for _, p := range periods {
		row := rows[p.Instrument]
		if row == nil {
			row = &attributionRow{}
			rows[p.Instrument] = row
		}

		ok, err := s.addPeriod(ctx, row, p, base, start, end)
		if err != nil {
			return nil, nil, err
		}

		if !ok {
			missing[p.Instrument] = true
		}
	}

	return rows, slices.Sorted(maps.Keys(missing)), nil
}

// addPeriod adds p to row; ok is false when an end has no price.
func (s *Service) addPeriod(
	ctx context.Context,
	row *attributionRow,
	p domain.HoldingPeriod,
	base money.Currency,
	start, end time.Time,
) (bool, error) {
	startValue, ok, err := s.heldValue(ctx, row, p.Instrument, p.Start.Quantity, base, start)
	if err != nil || !ok {
		return false, err
	}

	endValue, ok, err := s.heldValue(ctx, row, p.Instrument, p.End.Quantity, base, end)
	if err != nil || !ok {
		return false, err
	}

	row.startValue += startValue
	row.endValue += endValue
	row.startCost += p.Start.Cost
	row.endCost += p.End.Cost
	row.realized += p.Realized
	row.income += p.Income
	row.flows = append(row.flows, p.Flows...)

	return true, nil
}

// heldValue values units of code at the end of date in base and marks row stale when the price of
// code is older than staleDays (AT5); ok is false without a price.
func (s *Service) heldValue(
	ctx context.Context,
	row *attributionRow,
	code money.Currency,
	units int64,
	base money.Currency,
	date time.Time,
) (int64, bool, error) {
	if units == 0 {
		return 0, true, nil
	}

	q, err := s.amount(ctx, units, code)
	if err != nil {
		return 0, false, err
	}

	v, prices, err := s.value(ctx, q, base, date)
	if errors.Is(err, ErrPriceMissing) {
		return 0, false, nil
	}

	if err != nil {
		return 0, false, err
	}

	limit := date.AddDate(0, 0, -staleDays)
	for _, p := range prices {
		if p.Instrument == code && p.At == nil && p.Date.Before(limit) &&
			(row.staleSince == nil || p.Date.Before(*row.staleSince)) {
			row.staleSince = &p.Date
		}
	}

	return v.Amount(), true, nil
}

// fillAttribution sets the result of the portfolio (AT3) and of each instrument (AT2, AT4), sorted
// by result (AT7).
func fillAttribution(
	out *AttributionYear,
	report ReturnReport,
	rows map[money.Currency]*attributionRow,
	base money.Currency,
	start time.Time,
) error {
	total := report.Closing.Amount() - report.Opening.Amount()
	for _, f := range report.Flows {
		total -= f.Amount.Amount()
	}

	sum := int64(0)
	out.Items = make([]AttributionItem, 0, len(rows))

	for code, row := range rows {
		result := row.endValue - row.endCost - (row.startValue - row.startCost) +
			row.realized + row.income
		sum += result

		item, err := attributionItem(code, row, result, base, start, out.To)
		if err != nil {
			return err
		}

		out.Items = append(out.Items, item)
	}

	slices.SortFunc(out.Items, func(a, b AttributionItem) int {
		return cmp.Or(
			cmp.Compare(b.Result.Amount(), a.Result.Amount()),
			cmp.Compare(a.Instrument, b.Instrument),
		)
	})

	result, err := money.New(total, base)
	if err != nil {
		return err
	}

	other, err := money.New(total-sum, base)
	if err != nil {
		return err
	}

	out.Result, out.Other, out.PeriodBP = &result, &other, report.PeriodBP

	return nil
}

func attributionItem(
	code money.Currency,
	row *attributionRow,
	result int64,
	base money.Currency,
	start, end time.Time,
) (AttributionItem, error) {
	amount, err := money.New(result, base)
	if err != nil {
		return AttributionItem{}, err
	}

	item := AttributionItem{Instrument: code, Result: amount, StaleSince: row.staleSince}
	if row.staleSince == nil {
		if bp, ok := domain.DietzBP(start, end, row.startValue, result, row.flows); ok {
			item.ReturnBP = &bp
		}
	}

	return item, nil
}

func heldCodes(periods []domain.HoldingPeriod) []money.Currency {
	codes := make([]money.Currency, 0, len(periods))
	for _, p := range periods {
		codes = append(codes, p.Instrument)
	}

	return codes
}
