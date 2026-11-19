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
// RiskFloor is the fewest one-month returns they need.
const (
	RiskWindow = 36
	RiskFloor  = 12
)

// MonthValue is a class at the end of one month: its value and the flows of the month in minor
// units of one currency, or a State that leaves the value unknown.
type MonthValue struct {
	End   time.Time
	State string
	Value int64
	Flows []CashFlow
}

// MonthRisk is the figure of one month. Gain, Base and Return are those of the span that ends
// at the month (RK5, RK6); Span is its length in months, 0 when the month is not known.
type MonthRisk struct {
	End        time.Time
	State      string
	Gain, Base float64
	Return     float64
	Span       int

	Drawdown    float64
	HasDrawdown bool

	Volatility       float64
	VolatilityMonths int
}

// OneMonth reports whether the month holds a return of a span of one month.
func (m MonthRisk) OneMonth() bool {
	return m.State == MonthKnown && m.Span == 1
}

// Risk computes the spans, the drawdowns and the volatilities of months that follow a value of
// opening at start (RK5 to RK8).
func Risk(start time.Time, opening int64, months []MonthValue) []MonthRisk {
	out := spans(start, opening, months)
	addDrawdowns(out)

	for i := range out {
		out[i].Volatility, out[i].VolatilityMonths = volatility(out[:i+1])
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

// spans computes the modified Dietz return of each span between two known month ends (RK5, RK6).
func spans(start time.Time, opening int64, months []MonthValue) []MonthRisk {
	out := make([]MonthRisk, len(months))
	from, value := start, opening

	var pending []CashFlow

	length := 0

	for i, m := range months {
		pending = append(pending, m.Flows...)
		length++
		out[i] = MonthRisk{End: m.End, State: m.State}

		if m.State == MonthStale || m.State == MonthMissing {
			continue
		}

		out[i] = dietz(from, m.End, value, m.Value, pending)
		out[i].Span = length
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
