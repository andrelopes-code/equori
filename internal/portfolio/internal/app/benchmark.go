package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/portfolio/internal/domain"
)

var (
	// ErrUnknownIndex: the named index is not enabled or has no rate.
	ErrUnknownIndex = errors.New("unknown index")
	// ErrIndexNotDaily: the named index has a period longer than a day (amendment A208 N3).
	ErrIndexNotDaily = errors.New("index not daily")
)

// IndexRate is the rate of a daily index on the business day it applies to, a fraction.
type IndexRate struct {
	Date time.Time
	Rate float64
}

// Benchmark compares the time-weighted return of [from, Until] with an index over the same days
// (amendment A208 R3–R5). ReturnBP and PercentBP are nil when undefined.
type Benchmark struct {
	Index     string
	Until     time.Time
	ReturnBP  *int
	IndexBP   int
	PercentBP *int
}

// compare sets the time-weighted return of the period and its comparison with the index on
// report; the flows of report are in the currency of its opening value.
func (s *Service) compare(ctx context.Context, booksID int64, ids []uuid.UUID, from, to time.Time, index string, report *ReturnReport) error {
	index, rates, err := s.benchmarkRates(ctx, booksID, index, from, to)
	if err != nil {
		return err
	}

	values := map[time.Time]int64{}
	pieces := func(end time.Time) ([]domain.Subperiod, error) {
		return s.subperiods(ctx, booksID, ids, report, end, values)
	}

	ends, err := pieces(to)
	if err != nil {
		return err
	}

	if f, ok := domain.PeriodFactor(report.Opening.Amount(), ends); ok {
		report.PeriodBP = new(domain.FactorBP(f))
	}

	if len(rates) == 0 {
		return nil
	}

	fractions := make([]float64, len(rates))
	for i, r := range rates {
		fractions[i] = r.Rate
	}

	b := Benchmark{Index: index, Until: rates[len(rates)-1].Date, IndexBP: domain.FactorBP(domain.IndexFactor(fractions))}

	if ends, err = pieces(b.Until); err != nil {
		return err
	}

	if f, ok := domain.PeriodFactor(report.Opening.Amount(), ends); ok {
		b.ReturnBP = new(domain.FactorBP(f))
		if p, ok := domain.IndexPercentBP(f, fractions); ok {
			b.PercentBP = &p
		}
	}

	report.Benchmark = &b

	return nil
}

// benchmarkRates returns the index of the comparison and its rates in [from, to]. Without a
// named index, the region's default applies, and a default with no rate gives none.
func (s *Service) benchmarkRates(ctx context.Context, booksID int64, index string, from, to time.Time) (string, []IndexRate, error) {
	named := index != ""
	if !named {
		id, err := s.md.BenchmarkIndex(ctx, booksID)
		if err != nil || id == "" {
			return "", nil, err
		}

		index = id
	}

	rates, err := s.md.IndexRates(ctx, index, from, to)
	if !named && (errors.Is(err, ErrUnknownIndex) || errors.Is(err, ErrIndexNotDaily)) {
		return "", nil, nil
	}

	return index, rates, err
}

// subperiods lists the ends of the pieces of (from − 1, end]: each flow date on or before end,
// then end, with the value of the tree at the end of that day. values caches valuations by day.
func (s *Service) subperiods(ctx context.Context, booksID int64, ids []uuid.UUID, report *ReturnReport, end time.Time, values map[time.Time]int64) ([]domain.Subperiod, error) {
	flowOn := map[time.Time]int64{}
	dates := []time.Time{end}

	for _, f := range report.Flows {
		if f.Date.After(end) {
			continue
		}

		if _, seen := flowOn[f.Date]; !seen && !f.Date.Equal(end) {
			dates = append(dates, f.Date)
		}

		flowOn[f.Date] += f.Amount.Amount()
	}

	slices.SortFunc(dates, time.Time.Compare)

	out := make([]domain.Subperiod, len(dates))
	for i, d := range dates {
		v, cached := values[d]
		if !cached {
			m, err := s.valued(ctx, booksID, ids, d, report.Opening.Currency())
			if err != nil {
				return nil, err
			}

			v = m.Amount()
			values[d] = v
		}

		out[i] = domain.Subperiod{Value: v, Flow: flowOn[d]}
	}

	return out, nil
}
