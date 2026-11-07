package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/domain"
)

// Profiles of a return (amendment A208 R11).
const (
	ProfileRate   = "rate"
	ProfileMarket = "market"
)

const typeFixedIncome = "fixed_income"

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
	ReturnBP  *int
	IndexBP   int
	PercentBP *int
	ExcessBP  *int

	// AnnualBP and IndexAnnualBP are the return and the index growth as a rate a year on the
	// index's year basis (R9); AnnualBP and PercentBP exist only for the rate profile (R12).
	AnnualBP      *int
	IndexAnnualBP *int

	// PercentErrorBP bounds the error of PercentBP and AnnualBP, in basis points of themselves, for
	// a tree whose yield is recorded: Credits credits are rounded to the minor unit (R22).
	PercentErrorBP *int
}

// Inflation is the return net of inflation over the whole months [From, Until] (amendment A208
// R16).
type Inflation struct {
	Index    string
	From     time.Time
	Until    time.Time
	IndexBP  int
	ReturnBP int
	RealBP   int
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

// window is the days a comparison covers: the return of [returnFrom, until] and the whole months
// inside [since, until] (R16, R18), and the rates dated in [ratesFrom, ratesTo] on days the tree
// held money (R14, R20).
type window struct {
	since, until       time.Time
	returnFrom         time.Time
	ratesFrom, ratesTo time.Time
	restarted          bool
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

	w, ok := p.comparedWindow(start, ends, dates)
	if !ok {
		return nil
	}

	if err := s.benchmark(ctx, p, index, rates, heldDays(from, start, ends, dates, p.recorded), w); err != nil {
		return err
	}

	return s.inflation(ctx, p, heldDays(from, start, ends, dates, false), w)
}

// factor is the time-weighted factor of the pieces: a tree whose yield is recorded earns only
// yield, so a piece that starts at 0 contributes 1 (R20).
func (p period) factor(start int64, ends []domain.Subperiod) (float64, bool) {
	if p.recorded {
		return domain.RecordedPeriodFactor(start, ends)
	}

	return domain.PeriodFactor(start, ends)
}

// comparedWindow is the window of the index and inflation comparisons (R14, R18, R20): from the
// first day the tree held money to the end of the period. A tree whose yield is recorded is
// compared over (A, B], A being the first yield credit in [from − 1, to], moved by a flow between
// two distant credits, and B the last; its rates are those dated in [A, B). ok is false, with the
// reason on the report, when the tree held no money, recorded no yield or one credit only.
func (p period) comparedWindow(start int64, ends []domain.Subperiod, dates []time.Time) (window, bool) {
	since, ok := firstHeldDay(p.from, start, ends, dates)
	if !ok {
		p.unavailable(ReasonNothingHeld)

		return window{}, false
	}

	w := window{since: since, until: p.to, returnFrom: p.from, ratesFrom: since, ratesTo: p.to}
	if !p.recorded {
		return w, true
	}

	credits := p.creditDates()
	if len(credits) == 0 {
		p.unavailable(ReasonNoYieldRecorded)

		return window{}, false
	}

	a, restarted := domain.ComparisonStart(credits, p.flowDates())

	b := credits[len(credits)-1]
	if a.Equal(b) {
		p.unavailable(ReasonSingleCredit)

		return window{}, false
	}

	w.returnFrom = a.AddDate(0, 0, 1)
	w.until = b
	w.ratesFrom = a
	w.ratesTo = b.AddDate(0, 0, -1)
	w.restarted = restarted

	if w.returnFrom.After(since) {
		w.since = w.returnFrom
	}

	return w, true
}

// profileOf is ProfileRate when each asset account of the trees of ids holds currency in or a
// fixed income instrument quoted in it, and ProfileMarket otherwise (amendment A208 R11).
// recorded is true for a rate tree that holds no fixed income instrument: its yield is the income
// the ledger records (R18), while the yield of a fixed income instrument is in its price.
func (s *Service) profileOf(ctx context.Context, booksID int64, ids []uuid.UUID, in money.Currency) (profile string, recorded bool, err error) {
	accounts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return "", false, err
	}

	recorded = true

	for _, a := range treeAccounts(accounts, ids) {
		if a.Class != classAsset || a.Instrument == in {
			continue
		}

		info, err := s.md.InstrumentOf(ctx, a.Instrument)
		if err != nil {
			return "", false, err
		}

		if info.Type != typeFixedIncome || info.QuoteCurrency != in {
			return ProfileMarket, false, nil
		}

		recorded = false
	}

	return ProfileRate, recorded, nil
}

// benchmark sets the comparison with the index on p.report, over the rates of the index dated in
// the window on days the tree held money (R14, R18, R20).
func (s *Service) benchmark(ctx context.Context, p period, index string, rates []IndexRate, held func(time.Time) bool, w window) error {
	inPeriod := func(r IndexRate) bool { return !r.Date.Before(p.from) && !r.Date.After(p.to) }
	all := countFunc(rates, inPeriod)

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
		IndexBP:   domain.FactorBP(domain.IndexFactor(fractions)),
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

	if f, ok := p.factor(start, ends); ok {
		b.ReturnBP = new(domain.FactorBP(f))
		b.ExcessBP = new(*b.ReturnBP - b.IndexBP)

		if p.report.Profile == ProfileRate && precise {
			b.PercentBP = ifOK(domain.IndexPercentBP(f, fractions))
		}

		if b.PercentBP != nil {
			b.AnnualBP = ifOK(domain.AnnualBP(f, len(fractions), basis))
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

	rates, err := s.md.IndexRates(ctx, index, p.from.AddDate(0, 0, -1), p.to)
	if !named && (errors.Is(err, ErrUnknownIndex) || errors.Is(err, ErrIndexNotDaily)) {
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

// inflation sets the real return on p.report over the whole months of w on every day of which the
// tree held money (R16).
func (s *Service) inflation(ctx context.Context, p period, held func(time.Time) bool, w window) error {
	index, err := s.md.InflationIndex(ctx, p.booksID)
	if err != nil || index == "" || !s.inIndexCurrency(index, p.report) {
		return err
	}

	rates, err := s.md.MonthlyRates(ctx, index, p.from, p.to)
	if errors.Is(err, ErrUnknownIndex) || errors.Is(err, ErrIndexNotMonthly) {
		return nil
	}

	if err != nil {
		return err
	}

	byMonth := make(map[time.Time]float64, len(rates))
	for _, r := range rates {
		if heldMonth(r.Date, held) {
			byMonth[r.Date] = r.Rate
		}
	}

	first, until, monthly, ok := domain.WholeMonths(w.since, w.until, byMonth)
	if !ok {
		return nil
	}

	start, ends, _, err := s.pieces(ctx, p, first, until)
	if err != nil {
		return err
	}

	f, ok := p.factor(start, ends)
	if !ok {
		return nil
	}

	inflation := domain.IndexFactor(monthly)
	if real, ok := domain.RealBP(f, inflation); ok {
		p.report.Inflation = &Inflation{
			Index:    index,
			From:     first,
			Until:    until,
			IndexBP:  domain.FactorBP(inflation),
			ReturnBP: domain.FactorBP(f),
			RealBP:   real,
		}
	}

	return nil
}

// inIndexCurrency reports whether the report is valued in the currency of index, or the index
// has no known currency (R15).
func (s *Service) inIndexCurrency(index string, report *ReturnReport) bool {
	c := s.md.IndexCurrency(index)

	return c == "" || c == report.Opening.Currency()
}

// pieces lists the subperiods of (start − 1, end] of R1: the value of the tree at the end of
// start − 1, then each flow date in [start, end] and end, with the value of the tree at the end of
// that day and the day's flows. dates holds the end date of each subperiod.
func (s *Service) pieces(ctx context.Context, p period, start, end time.Time) (int64, []domain.Subperiod, []time.Time, error) {
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

// heldDays reports whether the tree held money on a day: a day belongs to the subperiod that ends
// on or after it, and that subperiod held money when its start value was not 0 (R14). With
// endOfDay, the day counts when the tree holds money at the end of it, the rate of a day being
// earned by the balance of its end (R20); the day before from is then the day of the opening value.
func heldDays(from time.Time, start int64, ends []domain.Subperiod, dates []time.Time, endOfDay bool) func(time.Time) bool {
	return func(day time.Time) bool {
		if endOfDay && day.Equal(from.AddDate(0, 0, -1)) {
			return start != 0
		}

		if day.Before(from) {
			return false
		}

		value := start
		for i, end := range dates {
			if day.After(end) {
				value = ends[i].Value

				continue
			}

			if endOfDay && day.Equal(end) {
				return ends[i].Value != 0
			}

			return value != 0
		}

		return false
	}
}

// heldMonth reports whether the tree held money on every day of the month that starts on first.
func heldMonth(first time.Time, held func(time.Time) bool) bool {
	for day := first; day.Before(first.AddDate(0, 1, 0)); day = day.AddDate(0, 0, 1) {
		if !held(day) {
			return false
		}
	}

	return true
}

// firstHeldDay is the first day of the period the tree held money: from when it held money at the
// end of from − 1, else the day after the first subperiod that ends with money. ok is false when
// no subperiod before the last one ends with money.
func firstHeldDay(from time.Time, start int64, ends []domain.Subperiod, dates []time.Time) (time.Time, bool) {
	if start != 0 {
		return from, true
	}

	for i := 0; i < len(ends)-1; i++ {
		if ends[i].Value != 0 {
			return dates[i].AddDate(0, 0, 1), true
		}
	}

	return time.Time{}, false
}

// treeAccounts returns the accounts of ids and their descendants.
func treeAccounts(accounts []Account, ids []uuid.UUID) []Account {
	in := make(map[uuid.UUID]bool, len(ids))
	for _, id := range ids {
		in[id] = true
	}

	// A parent can follow its child in accounts: repeat until no account joins the tree.
	for grew := true; grew; {
		grew = false

		for _, a := range accounts {
			if !in[a.ID] && in[a.ParentID] {
				in[a.ID] = true
				grew = true
			}
		}
	}

	var out []Account
	for _, a := range accounts {
		if in[a.ID] {
			out = append(out, a)
		}
	}

	return out
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
