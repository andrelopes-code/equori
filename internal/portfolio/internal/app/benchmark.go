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

// Benchmark compares the time-weighted return of [From, Until] with an index over the Days rates
// of the days the tree held money and, for a rate profile, recorded its yield; Skipped counts the
// rates of the period left out (amendment A208 R3–R5, R9, R12–R14, R18). The pointers are nil
// when undefined.
type Benchmark struct {
	Index     string
	From      time.Time
	Until     time.Time
	Days      int
	Skipped   int
	ReturnBP  *int
	IndexBP   int
	PercentBP *int
	ExcessBP  *int

	// AnnualBP and IndexAnnualBP are the return and the index growth as a rate a year on the
	// index's year basis (R9); AnnualBP and PercentBP exist only for the rate profile (R12).
	AnnualBP      *int
	IndexAnnualBP *int
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
}

// compare sets on report its profile, its time-weighted return, its comparison with the index
// and its real return; the flows of report are in the currency of its opening value.
func (s *Service) compare(ctx context.Context, booksID int64, ids []uuid.UUID, from, to time.Time, index string, report *ReturnReport) error {
	p := period{booksID: booksID, ids: ids, from: from, to: to, report: report, values: map[time.Time]int64{}}

	profile, err := s.profileOf(ctx, booksID, ids, report.Opening.Currency())
	if err != nil {
		return err
	}

	report.Profile = profile

	start, ends, dates, err := s.pieces(ctx, p, from, to)
	if err != nil {
		return err
	}

	if f, ok := domain.PeriodFactor(start, ends); ok {
		report.PeriodBP = new(domain.FactorBP(f))
	}

	if err := s.benchmark(ctx, p, index, heldDays(from, start, ends, dates)); err != nil {
		return err
	}

	return s.inflation(ctx, p)
}

// profileOf is ProfileRate when each asset account of the trees of ids holds currency in or a
// fixed income instrument quoted in it, and ProfileMarket otherwise (amendment A208 R11).
func (s *Service) profileOf(ctx context.Context, booksID int64, ids []uuid.UUID, in money.Currency) (string, error) {
	accounts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return "", err
	}

	for _, a := range treeAccounts(accounts, ids) {
		if a.Class != classAsset || a.Instrument == in {
			continue
		}

		info, err := s.md.InstrumentOf(ctx, a.Instrument)
		if err != nil {
			return "", err
		}

		if info.Type != typeFixedIncome || info.QuoteCurrency != in {
			return ProfileMarket, nil
		}
	}

	return ProfileRate, nil
}

// benchmark sets the comparison with the index on p.report. held reports whether the tree held
// money on a day (R14).
func (s *Service) benchmark(ctx context.Context, p period, index string, held func(time.Time) bool) error {
	index, rates, err := s.benchmarkRates(ctx, p, index)
	if err != nil {
		return err
	}

	all := len(rates)
	rates = slices.DeleteFunc(rates, func(r IndexRate) bool { return !held(r.Date) })

	if p.report.Profile == ProfileRate {
		if rates, err = s.recordedYield(ctx, p, rates); err != nil {
			return err
		}
	}

	if len(rates) == 0 {
		return nil
	}

	fractions := make([]float64, len(rates))
	for i, r := range rates {
		fractions[i] = r.Rate
	}

	b := Benchmark{
		Index:   index,
		From:    rates[0].Date,
		Until:   rates[len(rates)-1].Date,
		Days:    len(rates),
		Skipped: all - len(rates),
		IndexBP: domain.FactorBP(domain.IndexFactor(fractions)),
	}

	basis := s.md.YearBasis(index)
	if a, ok := domain.AnnualBP(domain.IndexFactor(fractions), len(fractions), basis); ok {
		b.IndexAnnualBP = &a
	}

	start, ends, _, err := s.pieces(ctx, p, p.from, b.Until)
	if err != nil {
		return err
	}

	if f, ok := domain.PeriodFactor(start, ends); ok {
		b.ReturnBP = new(domain.FactorBP(f))
		b.ExcessBP = new(*b.ReturnBP - b.IndexBP)

		if p.report.Profile == ProfileRate {
			b.PercentBP = ifOK(domain.IndexPercentBP(f, fractions))
			b.AnnualBP = ifOK(domain.AnnualBP(f, len(fractions), basis))
		}
	}

	p.report.Benchmark = &b

	return nil
}

// recordedYield keeps the rates of the days a rate tree recorded its yield (R18): a tree that
// received no income before the period compares from its first income in it, and a tree that
// received none in the period does not compare.
func (s *Service) recordedYield(ctx context.Context, p period, rates []IndexRate) ([]IndexRate, error) {
	before, first, found, err := s.ledger.FirstIncome(ctx, p.booksID, p.ids, p.from, p.to)
	if err != nil || !found {
		return nil, err
	}

	if before {
		return rates, nil
	}

	return slices.DeleteFunc(rates, func(r IndexRate) bool { return r.Date.Before(first) }), nil
}

// benchmarkRates returns the index of the comparison and its rates in [from, to]. Without a
// named index, the region's default applies, and a default with no rate gives none. An index of
// another currency than the report's gives none (R15).
func (s *Service) benchmarkRates(ctx context.Context, p period, index string) (string, []IndexRate, error) {
	named := index != ""
	if !named {
		id, err := s.md.BenchmarkIndex(ctx, p.booksID)
		if err != nil || id == "" {
			return "", nil, err
		}

		index = id
	}

	rates, err := s.md.IndexRates(ctx, index, p.from, p.to)
	if !named && (errors.Is(err, ErrUnknownIndex) || errors.Is(err, ErrIndexNotDaily)) {
		return "", nil, nil
	}

	if err != nil || !s.inIndexCurrency(index, p.report) {
		return "", nil, err
	}

	return index, rates, nil
}

// inflation sets the real return on p.report over the whole months of the period (R16).
func (s *Service) inflation(ctx context.Context, p period) error {
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
		byMonth[r.Date] = r.Rate
	}

	first, until, monthly, ok := domain.WholeMonths(p.from, p.to, byMonth)
	if !ok {
		return nil
	}

	start, ends, _, err := s.pieces(ctx, p, first, until)
	if err != nil {
		return err
	}

	f, ok := domain.PeriodFactor(start, ends)
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

	for _, f := range p.report.Flows {
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
// on or after it, and that subperiod held money when its start value was not 0 (R14).
func heldDays(from time.Time, start int64, ends []domain.Subperiod, dates []time.Time) func(time.Time) bool {
	return func(day time.Time) bool {
		if day.Before(from) {
			return false
		}

		value := start
		for i, end := range dates {
			if !day.After(end) {
				return value != 0
			}

			value = ends[i].Value
		}

		return false
	}
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
