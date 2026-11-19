package domain

import (
	"math"
	"time"
)

// States of a month of the risk history (portfolio risk design, RK3 and RK5).
const (
	MonthKnown       = "known"
	MonthStale       = "stale"
	MonthMissing     = "missing"
	MonthNothingHeld = "nothing_held"
	MonthNoBase      = "no_base"
)

// RiskWindow is the number of months a volatility, a correlation and a risk share read (RK7);
// RiskFloor is the fewest one-month returns they need. MaxExcluded is the largest share of value
// a month may leave out for a stale or missing price and still count as one month (RK3).
const (
	RiskWindow  = 36
	RiskFloor   = 12
	MaxExcluded = 0.10
)

// MonthValue is a holding at the end of one month: its value and the flows of the month in minor
// units of one currency, and a State when the price of the value is stale or missing.
type MonthValue struct {
	End   time.Time
	State string
	Value int64
	Flows []CashFlow
}

// MonthRisk is the figure of one month. Gain, Base and Return are those of the span that ends
// at the month (RK5, RK6); Span is its length in months, 0 when the month is not known. Value
// is the value at the end of the month, priced or not; Excluded is the share of the value of an
// aggregate left out for a stale or missing price (RK3).
type MonthRisk struct {
	End        time.Time
	State      string
	Gain, Base float64
	Return     float64
	Span       int
	Value      int64
	Excluded   float64

	Drawdown    float64
	HasDrawdown bool

	Volatility       float64
	VolatilityMonths int
}

// OneMonth reports whether the month holds a return of one month that stands for its value:
// a span of one month that leaves out at most MaxExcluded of the value.
func (m MonthRisk) OneMonth() bool {
	return m.State == MonthKnown && m.Span == 1 && m.Excluded <= MaxExcluded
}

// Risk computes the spans, the drawdowns and the volatilities of months that follow a value of
// opening at start (RK5 to RK8).
func Risk(start time.Time, opening int64, months []MonthValue) []MonthRisk {
	return Finish(Spans(start, opening, months))
}

// Finish adds the drawdowns and the volatilities to months (RK7, RK8).
func Finish(months []MonthRisk) []MonthRisk {
	addDrawdowns(months)

	for i := range months {
		months[i].Volatility, months[i].VolatilityMonths = volatility(months[:i+1])
	}

	return months
}

// Aggregate sums holdings that cover the same months into one series (RK3). A holding whose month
// is stale or missing is left out of that month, and its value counts in Excluded; the others
// make the month. Span is the longest span among the holdings counted.
func Aggregate(holdings [][]MonthRisk) []MonthRisk {
	if len(holdings) == 0 {
		return nil
	}

	out := make([]MonthRisk, len(holdings[0]))
	for i := range out {
		out[i] = aggregateMonth(holdings, i)
	}

	return out
}

// Correlation is the Pearson correlation of the one-month returns of the last RiskWindow months
// that a and b both hold (RK9); the two slices cover the same months.
func Correlation(a, b []MonthRisk) (float64, int, bool) {
	var xs, ys []float64

	for i := max(0, len(a)-RiskWindow); i < len(a) && i < len(b); i++ {
		if a[i].OneMonth() && b[i].OneMonth() {
			xs = append(xs, a[i].Return)
			ys = append(ys, b[i].Return)
		}
	}

	if len(xs) < RiskFloor {
		return 0, len(xs), false
	}

	sx, sy := math.Sqrt(covariance(xs, xs)), math.Sqrt(covariance(ys, ys))
	if sx == 0 || sy == 0 {
		return 0, len(xs), false
	}

	return covariance(xs, ys) / (sx * sy), len(xs), true
}

// RiskShares is the share of the variance of the portfolio each class carries over the last
// RiskWindow months with a one-month portfolio return (RK10). The contribution of a class in a
// month is its gain over the base of the portfolio; the classes cover the portfolio's months.
func RiskShares(classes [][]MonthRisk, portfolio []MonthRisk) ([]float64, bool) {
	var months []int

	for i := max(0, len(portfolio)-RiskWindow); i < len(portfolio); i++ {
		if portfolio[i].OneMonth() && portfolio[i].Base > 0 {
			months = append(months, i)
		}
	}

	if len(months) < RiskFloor {
		return nil, false
	}

	total := make([]float64, len(months))
	for j, i := range months {
		total[j] = portfolio[i].Return
	}

	variance := covariance(total, total)
	if variance == 0 {
		return nil, false
	}

	shares := make([]float64, len(classes))
	for c, class := range classes {
		contribution := make([]float64, len(months))
		for j, i := range months {
			contribution[j] = class[i].Gain / portfolio[i].Base
		}

		shares[c] = covariance(contribution, total) / variance
	}

	return shares, true
}

// BP is x in basis points, rounded half to even (RK13).
func BP(x float64) int {
	return int(math.RoundToEven(x * 10000))
}

// Spans computes the modified Dietz return of each span between two known month ends of one
// holding (RK5, RK6).
func Spans(start time.Time, opening int64, months []MonthValue) []MonthRisk {
	out := make([]MonthRisk, len(months))
	from, value := start, opening

	var pending []CashFlow

	length := 0

	for i, m := range months {
		pending = append(pending, m.Flows...)
		length++
		out[i] = MonthRisk{End: m.End, State: m.State, Value: m.Value}

		if m.State == MonthStale || m.State == MonthMissing {
			continue
		}

		out[i] = dietz(from, m.End, value, m.Value, pending)
		out[i].Span, out[i].Value = length, m.Value
		from, value, pending, length = m.End, m.Value, nil, 0
	}

	return out
}

// dietz is the modified Dietz figure of the span (from, to]: a flow on day d of a span of L days
// weighs (L − d) / L, so it earns from the next day.
func dietz(from, to time.Time, opening, closing int64, flows []CashFlow) MonthRisk {
	out := MonthRisk{End: to, State: MonthKnown}
	if opening == 0 && closing == 0 && len(flows) == 0 {
		out.State = MonthNothingHeld
		return out
	}

	days := to.Sub(from).Hours() / 24
	out.Gain = float64(closing - opening)
	out.Base = float64(opening)

	for _, f := range flows {
		weight := (days - f.Date.Sub(from).Hours()/24) / days
		out.Gain -= float64(f.Amount)
		out.Base += weight * float64(f.Amount)
	}

	if out.Base == 0 && out.Gain == 0 {
		out.State = MonthNothingHeld
		return out
	}

	if out.Base <= 0 {
		out.State = MonthNoBase
		return out
	}

	out.Return = out.Gain / out.Base

	return out
}

// aggregateMonth sums month i of the holdings: the counted ones give the gain and the base, the
// others the value left out and the state when none is counted.
func aggregateMonth(holdings [][]MonthRisk, i int) MonthRisk {
	out := MonthRisk{End: holdings[0][i].End, State: MonthNothingHeld}

	var counted, excluded int64

	for _, h := range holdings {
		m := h[i]

		switch m.State {
		case MonthKnown, MonthNoBase:
			out.Gain += m.Gain
			out.Base += m.Base
			out.Span = max(out.Span, m.Span)
			counted += m.Value
			out.State = MonthKnown
		case MonthStale, MonthMissing:
			excluded += m.Value

			if out.State != MonthKnown {
				out.State = worseState(out.State, m.State)
			}
		}
	}

	out.Value = counted + excluded
	if excluded > 0 && out.Value > 0 {
		out.Excluded = float64(excluded) / float64(out.Value)
	}

	if out.State != MonthKnown {
		out.Span, out.Gain, out.Base = 0, 0, 0
		return out
	}

	if out.Base <= 0 {
		out.State = MonthNoBase
		return out
	}

	out.Return = out.Gain / out.Base

	return out
}

// worseState is missing over stale over any other state.
func worseState(a, b string) string {
	if a == MonthMissing || b == MonthMissing {
		return MonthMissing
	}

	return MonthStale
}

// addDrawdowns chains the spans into an index and states each month's fall from its peak; a
// month without a base ends the run, and the index and its peak start again after it (RK8).
func addDrawdowns(months []MonthRisk) {
	index, peak := 1.0, 1.0

	for i := range months {
		switch months[i].State {
		case MonthKnown:
			index *= 1 + months[i].Return
		case MonthNothingHeld:
		case MonthNoBase:
			index, peak = 1, 1
			continue
		default:
			continue
		}

		peak = max(peak, index)
		months[i].Drawdown = index/peak - 1
		months[i].HasDrawdown = true
	}
}

// volatility is the annualized sample standard deviation of the one-month returns of the last
// RiskWindow months; 0 and 0 below RiskFloor returns (RK7).
func volatility(months []MonthRisk) (float64, int) {
	var rs []float64

	for _, m := range months[max(0, len(months)-RiskWindow):] {
		if m.OneMonth() {
			rs = append(rs, m.Return)
		}
	}

	if len(rs) < RiskFloor {
		return 0, 0
	}

	return math.Sqrt(covariance(rs, rs) * 12), len(rs)
}

// covariance is the sample covariance (n − 1) of two series of the same length, n ≥ 2.
func covariance(xs, ys []float64) float64 {
	var mx, my float64
	for i := range xs {
		mx += xs[i]
		my += ys[i]
	}

	n := float64(len(xs))
	mx, my = mx/n, my/n

	var sum float64
	for i := range xs {
		sum += (xs[i] - mx) * (ys[i] - my)
	}

	return sum / (n - 1)
}
