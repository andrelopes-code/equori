package app

import (
	"context"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// seriesIndexes draws the indexes of the region beside the series: the daily index of the
// comparison, then the inflation index (portfolio results PS5, PS6).
func (s *Service) seriesIndexes(
	ctx context.Context,
	p period,
	index string,
	rates []IndexRate,
	steps []time.Time,
) ([]IndexSeries, error) {
	out := []IndexSeries{}

	if daily, ok := dailySeries(index, rates, p.from, steps); ok {
		out = append(out, daily)
	}

	monthly, ok, err := s.monthlySeries(ctx, p)
	if err != nil {
		return nil, err
	}

	if ok {
		out = append(out, monthly)
	}

	return out, nil
}

// dailySeries has one point per step date: the growth of the rates dated in [from, date]. The
// rates start on from − 1 and the ones before from are dropped.
func dailySeries(
	index string,
	rates []IndexRate,
	from time.Time,
	steps []time.Time,
) (IndexSeries, bool) {
	fractions := make([]float64, 0, len(rates))
	dates := make([]time.Time, 0, len(rates))

	for _, r := range rates {
		if !r.Date.Before(from) {
			fractions = append(fractions, r.Rate)
			dates = append(dates, r.Date)
		}
	}

	if index == "" || len(fractions) == 0 {
		return IndexSeries{}, false
	}

	points := make([]IndexPoint, len(steps))
	n := 0

	for i, step := range steps {
		for n < len(dates) && !dates[n].After(step) {
			n++
		}

		factor := domain.IndexFactor(fractions[:n])
		points[i] = IndexPoint{Date: step, ReturnBP: domain.FactorBP(factor)}
	}

	return IndexSeries{Index: index, Period: "day", Points: points}, true
}

// monthlySeries has one point at the end of each whole month of [from, to] that holds a rate.
func (s *Service) monthlySeries(ctx context.Context, p period) (IndexSeries, bool, error) {
	index, err := s.md.InflationIndex(ctx, p.booksID)
	if err != nil || index == "" || !s.inIndexCurrency(index, p.report) {
		return IndexSeries{}, false, err
	}

	rates, err := s.md.MonthlyRates(ctx, index, p.from, p.to)
	if errors.Is(err, ErrUnknownIndex) || errors.Is(err, ErrIndexNotMonthly) {
		return IndexSeries{}, false, nil
	}

	if err != nil {
		return IndexSeries{}, false, err
	}

	byMonth := make(map[time.Time]float64, len(rates))
	for _, r := range rates {
		byMonth[r.Date] = r.Rate
	}

	ends, factors := domain.WholeMonthGrowth(p.from, p.to, byMonth)
	if len(ends) == 0 {
		return IndexSeries{}, false, nil
	}

	points := make([]IndexPoint, len(ends))
	for i, end := range ends {
		points[i] = IndexPoint{Date: end, ReturnBP: domain.FactorBP(factors[i])}
	}

	return IndexSeries{Index: index, Period: "month", Points: points}, true, nil
}
