package domain

import (
	"slices"
	"time"
)

// Spans computes the return of each span between two known month ends of one holding: chained
// over the marks for a span of one month, modified Dietz over a longer span, whose months hold no
// price to split it (RK5, RK6).
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

		if length == 1 {
			out[i] = timeWeighted(from, value, m, pending)
		} else {
			out[i] = dietz(from, m.End, value, m.Value, pending)
		}

		out[i].Span, out[i].Value = length, m.Value
		from, value, pending, length = m.End, m.Value, nil, 0
	}

	return out
}

// timeWeighted is the figure of a month split at its marks: each piece earns on the value at the
// end of the piece before, and a flow joins the value at the end of its day (RK5).
func timeWeighted(from time.Time, opening int64, m MonthValue, flows []CashFlow) MonthRisk {
	out := MonthRisk{End: m.End, State: MonthKnown}
	prev, prevDate := float64(opening), from
	points := append(slices.Clone(m.Marks), Mark{Date: m.End, Value: m.Value, Known: true})

	for _, p := range points {
		var flow float64

		for _, f := range flows {
			if f.Date.After(prevDate) && !f.Date.After(p.Date) {
				flow += float64(f.Amount)
			}
		}

		value := float64(p.Value)
		if !p.Known {
			value = prev + flow
		}

		out.Subs = append(out.Subs, Sub{Gain: value - prev - flow, Base: prev})
		prev, prevDate = value, p.Date
	}

	return chained(out)
}

// dietz is the modified Dietz figure of the span (from, to]: a flow on day d of a span of L days
// weighs (L − d) / L, so it earns from the next day. The span is one piece.
func dietz(from, to time.Time, opening, closing int64, flows []CashFlow) MonthRisk {
	days := to.Sub(from).Hours() / 24
	sub := Sub{Gain: float64(closing - opening), Base: float64(opening)}

	for _, f := range flows {
		weight := (days - f.Date.Sub(from).Hours()/24) / days
		sub.Gain -= float64(f.Amount)
		sub.Base += weight * float64(f.Amount)
	}

	return chained(MonthRisk{End: to, State: MonthKnown, Subs: []Sub{sub}})
}

// chained sets the return of m from its pieces. A piece without a positive base earns nothing:
// a holding bought in it earns from the next piece. A month with neither base nor gain holds
// nothing; one with a gain and no base has no base (RK5).
func chained(m MonthRisk) MonthRisk {
	growth, based, gained := 1.0, false, false

	for _, s := range m.Subs {
		gained = gained || s.Gain != 0

		if s.Base > 0 {
			growth *= 1 + s.Gain/s.Base
			based = true
		}
	}

	switch {
	case !based && !gained:
		m.State = MonthNothingHeld
	case !based:
		m.State = MonthNoBase
	default:
		m.Return = growth - 1
	}

	return m
}
