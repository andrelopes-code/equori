package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// Profiles of a return (amendment A208 R11).
const (
	ProfileRate   = "rate"
	ProfileMarket = "market"
)

var (
	// ErrUnknownIndex: the named index is not enabled or has no rate.
	ErrUnknownIndex = errors.New("unknown index")
	// ErrIndexNotDaily: the named index has a period longer than a day (amendment A208 N3).
	ErrIndexNotDaily = errors.New("index not daily")
	// ErrIndexNotMonthly: an inflation index whose period is not a month (amendment A208 R16).
	ErrIndexNotMonthly = errors.New("index not monthly")
)

// IndexRate is the rate of an index for the period it is dated on, a fraction: a business day
// for a daily index, the first day of its month for a monthly one.
type IndexRate struct {
	Date time.Time
	Rate float64
}

// Benchmark compares the time-weighted return with an index over the Days rates of the days the
// tree held money and, for a tree whose yield is recorded, dated between its credits; Skipped counts
// the rates of the period left out; Credits counts the credits the return covers and Restarted
// tells that a flow between two distant credits moved the start of the comparison (amendment A208
// R3–R5, R9, R12–R14, R18, R20, R22). The pointers are nil when undefined.
type Benchmark struct {
	Index     string
	From      time.Time
	Until     time.Time
	Days      int
	Skipped   int
	Credits   int
	Restarted bool

	// StartedLate tells that a rate of the period dated before From was left out: the comparison
	// starts after the first rate day of the window (R21).
	StartedLate bool
	ReturnBP    *int
	IndexBP     int
	PercentBP   *int
	ExcessBP    *int

	// AnnualBP and IndexAnnualBP are the return and the index growth as a rate a year on the
	// index's year basis (R9); AnnualBP and PercentBP exist only for the rate profile (R12).
	AnnualBP      *int
	IndexAnnualBP *int

	// PercentErrorBP bounds the error of PercentBP and AnnualBP, in basis points of themselves, for
	// a tree whose yield is recorded: Credits credits are rounded to the minor unit (R22).
	PercentErrorBP *int
}

// period holds what the figures of one report share: its tree, its window and the valuations
// already made, by day.
type period struct {
	booksID  int64
	ids      []uuid.UUID
	from, to time.Time
	report   *ReturnReport
	values   map[time.Time]int64

	// recorded is true when the yield of the tree is what the ledger records against the Yield
	// account (R18, R19); flows are then the flows of R19 and credits the yield credited.
	recorded bool
	flows    []ReturnFlow
	credits  []valuedCredit
}

// compare sets on report its profile, its time-weighted return, its comparison with the index
// and its real return; the flows of report are in the currency of its opening value. A named index
// is validated before any figure is left out (R2).
func (s *Service) compare(ctx context.Context, booksID int64, ids []uuid.UUID, from, to time.Time, index string, report *ReturnReport) error {
	p := period{booksID: booksID, ids: ids, from: from, to: to, report: report, values: map[time.Time]int64{}, flows: report.Flows}

	profile, recorded, err := s.profileOf(ctx, booksID, ids, report.Opening.Currency())
	if err != nil {
		return err
	}

	report.Profile = profile
	p.recorded = recorded

	index, rates, err := s.benchmarkRates(ctx, p, index)
	if err != nil {
		return err
	}

	if recorded {
		if err := s.recordFlows(ctx, &p, rates); err != nil {
			return err
		}
	}

	start, ends, dates, err := s.pieces(ctx, p, from, to)
	if err != nil {
		return err
	}

	if f, ok := p.factor(start, ends); ok {
		report.PeriodBP = new(domain.FactorBP(f))
	}

	w, ok := p.comparedWindow(start, ends, dates, rates)
	if !ok {
		return nil
	}

	if err := s.benchmark(ctx, p, index, rates, heldDays(from, start, ends, dates, p.recorded), w); err != nil {
		return err
	}

	return s.inflation(ctx, p, heldDays(from, start, ends, dates, false), w)
}

// benchmark sets the comparison with the index on p.report, over the rates of the index dated in
// the window on days the tree held money (R14, R18, R20).
func (s *Service) benchmark(ctx context.Context, p period, index string, rates []IndexRate, held func(time.Time) bool, w window) error {
	inPeriod := func(r IndexRate) bool { return !r.Date.Before(p.from) && !r.Date.After(p.to) }
	all := countFunc(rates, inPeriod)

	var firstDay time.Time
	if i := slices.IndexFunc(rates, inPeriod); i >= 0 {
		firstDay = rates[i].Date
	}

	rates = slices.DeleteFunc(rates, func(r IndexRate) bool {
		return r.Date.Before(w.ratesFrom) || r.Date.After(w.ratesTo) || !held(r.Date)
	})

	if len(rates) == 0 {
		p.unavailable(ReasonNoRateInWindow)

		return nil
	}

	fractions := make([]float64, len(rates))
	for i, r := range rates {
		fractions[i] = r.Rate
	}

	b := Benchmark{
		Index:     index,
		From:      rates[0].Date,
		Until:     rates[len(rates)-1].Date,
		Days:      len(rates),
		Skipped:   all - countFunc(rates, inPeriod),
		Restarted: w.restarted,

		StartedLate: !firstDay.IsZero() && rates[0].Date.After(firstDay),

		IndexBP: domain.FactorBP(domain.IndexFactor(fractions)),
	}

	basis := s.md.YearBasis(index)
	if a, ok := domain.AnnualBP(domain.IndexFactor(fractions), len(fractions), basis); ok {
		b.IndexAnnualBP = &a
	}

	end := b.Until
	if p.recorded {
		end = w.until
	}

	start, ends, _, err := s.pieces(ctx, p, w.returnFrom, end)
	if err != nil {
		return err
	}

	precise := p.countCredits(&b, w)

	if f, ok := p.factor(start, ends); !ok {
		p.unavailable(ReasonPercentUndefined)
	} else {
		b.ReturnBP = new(domain.FactorBP(f))
		b.ExcessBP = new(*b.ReturnBP - b.IndexBP)

		if p.report.Profile == ProfileRate && precise {
			b.PercentBP = ifOK(domain.IndexPercentBP(f, fractions))
		}

		if p.report.Profile == ProfileRate && precise && b.PercentBP == nil {
			p.unavailable(ReasonPercentUndefined)
		}

		if b.PercentBP != nil {
			b.AnnualBP = ifOK(domain.AnnualBP(f, len(fractions), basis))
		}

		if b.PercentBP != nil && b.Days < domain.MinPercentDays {
			b.PercentBP, b.AnnualBP = nil, nil

			p.unavailable(ReasonTooFewDays)
		}
	}

	p.report.Benchmark = &b

	return nil
}

// countCredits sets on b the credits of (A, B] and the error bound of its percent (R22); it
// reports whether the percent is precise enough to show. Other trees have no credits and no bound.
func (p period) countCredits(b *Benchmark, w window) bool {
	if !p.recorded {
		return true
	}

	n, postings, yield := p.creditsIn(w.returnFrom.AddDate(0, 0, -1), w.until)
	b.Credits = n

	bound, ok := domain.PercentErrorBP(postings, yield)
	if ok {
		b.PercentErrorBP = &bound
	}

	if ok && bound <= domain.MaxPercentErrorBP {
		return true
	}

	p.unavailable(ReasonTooSmall)

	return false
}

// benchmarkRates returns the index of the comparison and its rates in [from − 1, to]. Without a
// named index, the region's default applies, and a default with no rate gives none. An index of
// another currency than the report's gives none (R15).
func (s *Service) benchmarkRates(ctx context.Context, p period, index string) (string, []IndexRate, error) {
	named := index != ""
	if !named {
		id, err := s.md.BenchmarkIndex(ctx, p.booksID)
		if err != nil || id == "" {
			p.unavailable(ReasonNoIndexForRegion)

			return "", nil, err
		}

		index = id
	}

	p.report.Index = index

	rates, err := s.md.IndexRates(ctx, index, p.from.AddDate(0, 0, -1), p.to)
	if !named && (errors.Is(err, ErrUnknownIndex) || errors.Is(err, ErrIndexNotDaily)) {
		p.report.Index = ""
		p.unavailable(ReasonNoIndexForRegion)

		return "", nil, nil
	}

	if err != nil {
		return "", nil, err
	}

	if !s.inIndexCurrency(index, p.report) {
		p.unavailable(ReasonCurrencyMismatch)

		return "", nil, nil
	}

	return index, rates, nil
}

// inIndexCurrency reports whether the report is valued in the currency of index, or the index
// has no known currency (R15).
func (s *Service) inIndexCurrency(index string, report *ReturnReport) bool {
	c := s.md.IndexCurrency(index)

	return c == "" || c == report.Opening.Currency()
}

// ifOK is &v when ok, else nil.
func ifOK(v int, ok bool) *int {
	if !ok {
		return nil
	}

	return &v
}

// countFunc counts the rates for which keep is true.
func countFunc(rates []IndexRate, keep func(IndexRate) bool) int {
	n := 0

	for _, r := range rates {
		if keep(r) {
			n++
		}
	}

	return n
}
