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

// Benchmark compares the time-weighted return of [From, Until] with an index over the same days
// (amendment A208 R3–R5). ReturnBP and PercentBP are nil when undefined.
type Benchmark struct {
	Index     string
	From      time.Time
	Until     time.Time
	ReturnBP  *int
	IndexBP   int
	PercentBP *int

	// AnnualBP and IndexAnnualBP are the return and the index growth as a rate a year on the
	// index's year basis (R9), nil when the basis is unknown or the return undefined.
	AnnualBP      *int
	IndexAnnualBP *int
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

	start, held := windowStart(from, report)
	rates = slices.DeleteFunc(rates, func(r IndexRate) bool { return r.Date.Before(start) })

	if !held || len(rates) == 0 {
		return nil
	}

	fractions := make([]float64, len(rates))
	for i, r := range rates {
		fractions[i] = r.Rate
	}

	b := Benchmark{
		Index:   index,
		From:    start,
		Until:   rates[len(rates)-1].Date,
		IndexBP: domain.FactorBP(domain.IndexFactor(fractions)),
	}

	basis := s.md.YearBasis(index)
	if a, ok := domain.AnnualBP(domain.IndexFactor(fractions), len(fractions), basis); ok {
		b.IndexAnnualBP = &a
	}

	if ends, err = pieces(b.Until); err != nil {
		return err
	}

	if f, ok := domain.PeriodFactor(report.Opening.Amount(), ends); ok {
		b.ReturnBP = new(domain.FactorBP(f))
		if p, ok := domain.IndexPercentBP(f, fractions); ok {
			b.PercentBP = &p
		}

		if a, ok := domain.AnnualBP(f, len(fractions), basis); ok {
			b.AnnualBP = &a
		}
	}

	report.Benchmark = &b

	return nil
}

// windowStart is the first day of the comparison (amendment A208 R3): from, or the day after the
// first flow when the tree holds nothing at the end of from − 1, since a flow earns from the next
// day. held is false when the tree holds nothing and has no flow.
// shortcut: a tree emptied inside the period still counts its empty days; trim them when a
// withdrawal of the whole balance becomes common.
func windowStart(from time.Time, report *ReturnReport) (time.Time, bool) {
	if report.Opening.Amount() != 0 {
		return from, true
	}

	if len(report.Flows) == 0 {
		return time.Time{}, false
	}

	first := report.Flows[0].Date
	for _, f := range report.Flows[1:] {
		if f.Date.Before(first) {
			first = f.Date
		}
	}

	return first.AddDate(0, 0, 1), true
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
