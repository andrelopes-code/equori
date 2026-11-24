package app

import (
	"context"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// seriesIndexes draws the indexes beside the series: the daily index of the comparison, the
// inflation index, both of the region, then the enabled market indexes (portfolio results PS5, PS6,
// PS8).
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

	markets, err := s.marketSeries(ctx, p, index, steps)

	return append(out, markets...), err
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

// marketSeries draws each enabled market index, in the currency of the report, other than the one
// already drawn. An index without a conversion to that currency, or without a rate in the period, is
// left out.
func (s *Service) marketSeries(
	ctx context.Context,
	p period,
	drawn string,
	steps []time.Time,
) ([]IndexSeries, error) {
	ids, err := s.md.MarketIndexes(ctx)
	if err != nil {
		return nil, err
	}

	var out []IndexSeries

	for _, id := range ids {
		if id == drawn {
			continue
		}

		rates, err := s.md.IndexRates(ctx, id, p.from.AddDate(0, 0, -1), p.to)
		if err != nil {
			return nil, err
		}

		rates, ok, err := s.inReportCurrency(ctx, p, id, rates)
		if err != nil {
			return nil, err
		}

		if !ok {
			continue
		}

		if series, ok := dailySeries(id, rates, p.from, steps); ok {
			out = append(out, series)
		}
	}

	return out, nil
}
