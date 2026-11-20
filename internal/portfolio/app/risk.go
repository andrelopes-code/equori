package app

import (
	"cmp"
	"context"
	"maps"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// RiskSeries is the monthly risk history of the portfolio or of one class (portfolio risk
// design). The summary is that of the last month with a volatility (RK14).
type RiskSeries struct {
	Key    string
	Months []domain.MonthRisk

	VolatilityBP     *int
	VolatilityMonths int
	MaxDrawdownBP    *int

	WeightBP, RiskShareBP, AccrualBP *int
}

// RiskCorrelation is the correlation of the monthly returns of two classes (RK9).
type RiskCorrelation struct {
	A, B          string
	CorrelationBP int
	Months        int
}

// RiskLeftOut is a security whose months were left out for a stale or missing price (RK3).
type RiskLeftOut struct {
	Instrument money.Currency
	Months     int
}

// RiskReport is the risk history of the brokerage trees of a book in one currency; From and To
// are the first and last month ends, zero without a month.
type RiskReport struct {
	Currency     money.Currency
	From, To     time.Time
	Portfolio    RiskSeries
	Classes      []RiskSeries
	Correlations []RiskCorrelation
	LeftOut      []RiskLeftOut
}

// Risk is the monthly risk history of the portfolio and of each class of it, from the month of
// its first posting to the last month that ends on or before to (portfolio risk design, RK1 to
// RK14). to defaults to today of the book and in to the base currency.
func (s *Service) Risk(
	ctx context.Context,
	booksID int64,
	to time.Time,
	in money.Currency,
) (RiskReport, error) {
	in, err := s.reportCurrency(ctx, booksID, in)
	if err != nil {
		return RiskReport{}, err
	}

	report := RiskReport{Currency: in}

	if to.IsZero() {
		to = s.ledger.Today(ctx)
	}

	book, err := s.riskBook(ctx, booksID)
	if err != nil || len(book.roots) == 0 {
		return report, err
	}

	first, ok, err := s.ledger.FirstPosting(ctx, booksID, book.roots)
	if err != nil || !ok {
		return report, err
	}

	ends := monthEnds(first, to)
	if len(ends) == 0 {
		return report, nil
	}

	inputs, err := s.riskInputs(ctx, booksID, book, ends, in)
	if err != nil {
		return RiskReport{}, err
	}

	report.From, report.To = ends[0], ends[len(ends)-1]
	report.Portfolio, report.Classes = riskSeries(previousMonthEnd(ends[0]), inputs)
	report.Correlations = correlations(report.Classes)
	report.LeftOut = leftOut(inputs)

	return report, nil
}

// riskSeries computes the spans of every holding and aggregates them into each class and into the
// portfolio (RK3), with the weights, the risk shares and the accrual of the last month the
// portfolio knows (RK10, RK11).
func riskSeries(start time.Time, inputs riskInputs) (RiskSeries, []RiskSeries) {
	byClass := map[string][][]domain.MonthRisk{}

	var all [][]domain.MonthRisk

	accrual := map[string][]int64{}

	for _, id := range slices.Sorted(maps.Keys(inputs.holdings)) {
		h := inputs.holdings[id]
		spans := domain.Spans(start, 0, h.months)
		byClass[h.class] = append(byClass[h.class], spans)
		all = append(all, spans)
		accrual[h.class] = addInts(accrual[h.class], h.accrual)
	}

	portfolio := summarized("", domain.Finish(domain.Aggregate(all)))

	keys := inputs.classes()
	classes := make([]RiskSeries, len(keys))

	for i, key := range keys {
		classes[i] = summarized(key, domain.Finish(domain.Aggregate(byClass[key])))
	}

	for i, m := range slices.Backward(portfolio.Months) {
		if m.State == domain.MonthKnown || m.State == domain.MonthNothingHeld {
			addWeights(&portfolio, classes, accrual, i)
			break
		}
	}

	holdings := make([][][]domain.MonthRisk, len(classes))
	for i, c := range classes {
		holdings[i] = byClass[c.Key]
	}

	if shares, ok := domain.RiskShares(holdings, portfolio.Months); ok {
		for i := range classes {
			classes[i].RiskShareBP = ptr(domain.BP(shares[i]))
		}
	}

	slices.SortStableFunc(classes, func(a, b RiskSeries) int {
		return cmp.Or(cmp.Compare(deref(b.WeightBP), deref(a.WeightBP)), cmp.Compare(a.Key, b.Key))
	})

	return portfolio, classes
}

// summarized fills the summary of a series from its months.
func summarized(key string, months []domain.MonthRisk) RiskSeries {
	out := RiskSeries{Key: key, Months: months}

	for _, m := range months {
		if m.VolatilityMonths > 0 {
			out.VolatilityBP = ptr(domain.BP(m.Volatility))
			out.VolatilityMonths = m.VolatilityMonths
		}

		if m.HasDrawdown &&
			(out.MaxDrawdownBP == nil || domain.BP(m.Drawdown) < *out.MaxDrawdownBP) {
			out.MaxDrawdownBP = ptr(domain.BP(m.Drawdown))
		}
	}

	return out
}

// addWeights states the share of value and of accrual of each class at month i (RK10, RK11).
func addWeights(
	portfolio *RiskSeries,
	classes []RiskSeries,
	accrued map[string][]int64,
	i int,
) {
	holdings := make([]domain.Holding, len(classes))

	var value, accrual int64

	for c, class := range classes {
		v := class.Months[i].Value
		holdings[c] = domain.Holding{Key: class.Key, Value: v}
		value += v
		accrual += accrued[class.Key][i]

		if v > 0 {
			classes[c].AccrualBP = ptr(domain.BP(float64(accrued[class.Key][i]) / float64(v)))
		}
	}

	if value > 0 {
		portfolio.AccrualBP = ptr(domain.BP(float64(accrual) / float64(value)))
	}

	shares := map[string]int{}
	for _, g := range domain.Allocate(holdings) {
		shares[g.Key] = g.ShareBP
	}

	for c := range classes {
		classes[c].WeightBP = ptr(shares[classes[c].Key])
	}
}

// correlations pairs every two classes, in the order of the classes (RK9).
func correlations(classes []RiskSeries) []RiskCorrelation {
	var out []RiskCorrelation

	for i, a := range classes {
		for _, b := range classes[i+1:] {
			c, n, ok := domain.Correlation(a.Months, b.Months)
			if ok {
				out = append(out, RiskCorrelation{
					A:             a.Key,
					B:             b.Key,
					CorrelationBP: domain.BP(c),
					Months:        n,
				})
			}
		}
	}

	return out
}

// leftOut lists the securities with a stale or missing month, the most months first, then by
// code; a security held by two accounts adds its months.
func leftOut(inputs riskInputs) []RiskLeftOut {
	months := map[money.Currency]int{}

	for _, h := range inputs.holdings {
		for _, m := range h.months {
			if h.instrument != "" &&
				(m.State == domain.MonthStale || m.State == domain.MonthMissing) {
				months[h.instrument]++
			}
		}
	}

	out := make([]RiskLeftOut, 0, len(months))
	for code, n := range months {
		out = append(out, RiskLeftOut{Instrument: code, Months: n})
	}

	slices.SortFunc(out, func(a, b RiskLeftOut) int {
		return cmp.Or(cmp.Compare(b.Months, a.Months), cmp.Compare(a.Instrument, b.Instrument))
	})

	return out
}

// monthEnds are the last days of the months from the month of first to the last month whose
// last day is on or before to (RK2).
func monthEnds(first, to time.Time) []time.Time {
	var out []time.Time

	for end := monthEnd(first); !end.After(to); end = monthEnd(end.AddDate(0, 0, 1)) {
		out = append(out, end)
	}

	return out
}

func monthEnd(d time.Time) time.Time {
	return time.Date(d.Year(), d.Month()+1, 0, 0, 0, 0, 0, d.Location())
}

func previousMonthEnd(end time.Time) time.Time {
	return time.Date(end.Year(), end.Month(), 0, 0, 0, 0, 0, end.Location())
}

// addInts adds b to a element by element; a nil a takes the length of b.
func addInts(a, b []int64) []int64 {
	if a == nil {
		a = make([]int64, len(b))
	}

	for i := range b {
		a[i] += b[i]
	}

	return a
}

func ptr(v int) *int {
	return &v
}

func deref(v *int) int {
	if v == nil {
		return -1
	}

	return *v
}
