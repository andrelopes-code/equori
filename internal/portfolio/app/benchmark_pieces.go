package app

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// periodOf builds the period of a report, with its profile, the index of its comparison and the
// rates of that index, and the flows of R19 when the yield of the tree is recorded. A named index
// is validated before any figure is left out (R2).
func (s *Service) periodOf(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
	from, to time.Time,
	index string,
	report *ReturnReport,
) (period, string, []IndexRate, error) {
	p := newPeriod(booksID, ids, from, to, report)

	profile, recorded, err := s.profileOf(ctx, booksID, ids, report.Opening.Currency())
	if err != nil {
		return period{}, "", nil, err
	}

	report.Profile = profile
	p.recorded = recorded

	index, rates, err := s.benchmarkRates(ctx, p, index)
	if err != nil {
		return period{}, "", nil, err
	}

	if recorded {
		if err := s.recordFlows(ctx, &p, rates); err != nil {
			return period{}, "", nil, err
		}
	}

	return p, index, rates, nil
}

// factor is the time-weighted factor of the pieces: a tree whose yield is recorded earns only
// yield, so a piece that starts at 0 contributes 1 (R20).
func (p period) factor(start int64, ends []domain.Subperiod) (float64, bool) {
	if p.recorded {
		return domain.RecordedPeriodFactor(start, ends)
	}

	return domain.PeriodFactor(start, ends)
}

// pieces lists the subperiods of (start − 1, end] of R1: the value of the tree at the end of
// start − 1, then each flow date in [start, end] and end, with the value of the tree at the end of
// that day and the day's flows. dates holds the end date of each subperiod.
func (s *Service) pieces(
	ctx context.Context,
	p period,
	start, end time.Time,
) (int64, []domain.Subperiod, []time.Time, error) {
	before := start.AddDate(0, 0, -1)

	opening := p.report.Opening.Amount()
	if !start.Equal(p.from) {
		v, err := s.valueOn(ctx, p, before)
		if err != nil {
			return 0, nil, nil, err
		}

		opening = v
	}

	flowOn := map[time.Time]int64{}
	dates := []time.Time{end}

	for _, f := range p.flows {
		if f.Date.Before(start) || f.Date.After(end) {
			continue
		}

		if _, seen := flowOn[f.Date]; !seen && !f.Date.Equal(end) {
			dates = append(dates, f.Date)
		}

		flowOn[f.Date] += f.Amount.Amount()
	}

	for _, c := range p.cuts {
		if !c.Before(start) && c.Before(end) && !slices.Contains(dates, c) {
			dates = append(dates, c)
		}
	}

	slices.SortFunc(dates, time.Time.Compare)

	out := make([]domain.Subperiod, len(dates))
	for i, d := range dates {
		v, err := s.valueOn(ctx, p, d)
		if err != nil {
			return 0, nil, nil, err
		}

		out[i] = domain.Subperiod{Value: v, Flow: flowOn[d]}
	}

	return opening, out, dates, nil
}

// valueOn is the value of the tree at the end of day, valued once per day.
func (s *Service) valueOn(ctx context.Context, p period, day time.Time) (int64, error) {
	if v, ok := p.values[day]; ok {
		return v, nil
	}

	m, err := s.valued(ctx, p.booksID, p.ids, day, p.report.Opening.Currency())
	if err != nil {
		return 0, err
	}

	p.values[day] = m.Amount()

	return m.Amount(), nil
}
