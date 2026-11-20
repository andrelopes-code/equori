package app

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// compareYear sets the rate and the inflation comparisons of out (AT10 to AT12): each one is
// absent when the region has no such index, its currency is not the base, or it has no rate in
// the year.
func (s *Service) compareYear(
	ctx context.Context,
	booksID int64,
	roots []uuid.UUID,
	base money.Currency,
	out *AttributionYear,
) error {
	rate, err := s.rateComparison(ctx, booksID, roots, base, out)
	if err != nil {
		return err
	}

	inflation, err := s.inflationComparison(ctx, booksID, roots, base, out)
	if err != nil {
		return err
	}

	out.Rate, out.Inflation = rate, inflation

	return nil
}

// rateComparison grows the money each day by the rate of the region's daily index dated that day
// (AT11), up to its last rate in the year.
func (s *Service) rateComparison(
	ctx context.Context,
	booksID int64,
	roots []uuid.UUID,
	base money.Currency,
	out *AttributionYear,
) (*AttributionCompare, error) {
	index, err := s.md.BenchmarkIndex(ctx, booksID)
	if err != nil || index == "" || !s.indexOf(index, base) {
		return nil, err
	}

	rates, err := s.md.IndexRates(ctx, index, out.Since, out.To)
	if errors.Is(err, ErrUnknownIndex) || errors.Is(err, ErrIndexNotDaily) ||
		!coversDays(out.Since, rates) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	byDay := make(map[time.Time]float64, len(rates))
	for _, r := range rates {
		byDay[r.Date] = 1 + r.Rate
	}

	growth := func(d time.Time) float64 {
		if g, ok := byDay[d]; ok {
			return g
		}

		return 1
	}

	return s.comparison(
		ctx,
		booksID,
		roots,
		base,
		out,
		rates[len(rates)-1].Date,
		index,
		growth,
		false,
	)
}

// inflationComparison spreads the rate of each month of the region's monthly index over its days
// (AT11), up to the last month of the year whose rate and every earlier one are known.
func (s *Service) inflationComparison(
	ctx context.Context,
	booksID int64,
	roots []uuid.UUID,
	base money.Currency,
	out *AttributionYear,
) (*AttributionCompare, error) {
	index, err := s.md.InflationIndex(ctx, booksID)
	if err != nil || index == "" || !s.indexOf(index, base) {
		return nil, err
	}

	rates, err := s.md.MonthlyRates(ctx, index, out.From, out.To)
	if errors.Is(err, ErrUnknownIndex) || errors.Is(err, ErrIndexNotMonthly) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	byMonth := make(map[time.Time]float64, len(rates))
	for _, r := range rates {
		byMonth[r.Date] = r.Rate
	}

	first := time.Date(out.Since.Year(), out.Since.Month(), 1, 0, 0, 0, 0, time.UTC)

	until, ok := wholeMonthsUntil(first, out.To, byMonth)
	if !ok {
		return nil, nil
	}

	growth := func(d time.Time) float64 {
		month := time.Date(d.Year(), d.Month(), 1, 0, 0, 0, 0, time.UTC)
		days := month.AddDate(0, 1, -1).Day()

		return math.Pow(1+byMonth[month], 1/float64(days))
	}

	return s.comparison(ctx, booksID, roots, base, out, until, index, growth, true)
}

// wholeMonthsUntil is the last day of the last month, counted from the month of from, whose rate
// and every earlier one are known and that ends by to; ok is false without such a month.
func wholeMonthsUntil(from, to time.Time, rates map[time.Time]float64) (time.Time, bool) {
	var until time.Time

	for m := from; !m.AddDate(0, 1, -1).After(to); m = m.AddDate(0, 1, 0) {
		if _, ok := rates[m]; !ok {
			break
		}

		until = m.AddDate(0, 1, -1)
	}

	return until, !until.IsZero()
}

// comparison measures the portfolio and the same money at the index over [Since, until] of out on
// one capital (AT10), with the real return when the index is the inflation one (AT12).
func (s *Service) comparison(
	ctx context.Context,
	booksID int64,
	roots []uuid.UUID,
	base money.Currency,
	out *AttributionYear,
	until time.Time,
	index string,
	growth func(time.Time) float64,
	real bool,
) (*AttributionCompare, error) {
	tree, err := s.treeMoney(ctx, booksID, roots, out.From, until, base)
	if err != nil {
		return nil, err
	}

	start := out.Since.AddDate(0, 0, -1)
	result, flows := treeResult(tree)
	capital := domain.Capital(start, until, tree.Opening.Amount(), flows)

	returnBP, ok := domain.RatioBP(result, capital)
	if !ok {
		return nil, nil
	}

	indexResult := domain.IndexedResult(start, until, tree.Opening.Amount(), flows, growth)
	indexBP, _ := domain.RatioBP(indexResult, capital)

	c := &AttributionCompare{Index: index, Until: until, ReturnBP: returnBP, IndexBP: indexBP}
	if real {
		c.RealBP = ifOK(domain.RealOnCapital(result, indexResult, capital))
	}

	if c.Result, err = money.New(result, base); err != nil {
		return nil, err
	}

	if c.IndexResult, err = money.New(indexResult, base); err != nil {
		return nil, err
	}

	return c, nil
}

// maxRateGap is the longest run of days without a rate that still covers a period: a weekend
// beside two holidays (AT11).
const maxRateGap = 7

// coversDays reports whether daily rates cover the days from since: the first rate within
// maxRateGap days of it and no two rates further apart (AT11). A hole would read as no growth.
func coversDays(since time.Time, rates []IndexRate) bool {
	if len(rates) == 0 || rates[0].Date.Sub(since) > maxRateGap*24*time.Hour {
		return false
	}

	for i := 1; i < len(rates); i++ {
		if rates[i].Date.Sub(rates[i-1].Date) > maxRateGap*24*time.Hour {
			return false
		}
	}

	return true
}

// indexOf reports whether index belongs to base, or has no known currency (R15).
func (s *Service) indexOf(index string, base money.Currency) bool {
	c := s.md.IndexCurrency(index)

	return c == "" || c == base
}
