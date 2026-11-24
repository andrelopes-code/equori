// Package index reads the rates of an economic index from a public source: the anti-corruption
// layer of the accrual of fixed income securities (investments design 4.2).
package index

import (
	"context"
	"fmt"
	"math/big"
	"time"
)

// decimals is the precision of a rate computed from two levels.
const decimals = 12

// Rate is the rate of an index for the period that ends on Date, an exact decimal fraction
// (0.00055131 is 0.055131%).
type Rate struct {
	Date  time.Time
	Value string
}

// Periods of an index: the span one rate covers.
const (
	PeriodDay   = "day"
	PeriodMonth = "month"
)

// Kinds of an index: a rate a contract pays, or the growth of a market that no contract pays.
const (
	KindRate   = "rate"
	KindMarket = "market"
)

// Kinded is implemented by a Source whose index is not of KindRate (A265 MI6).
type Kinded interface {
	Kind() string
}

// BusinessDayCompounding is implemented by a Source whose index compounds by business day: a fixed
// income security on it compounds the rate of each published business day times its percent and
// may count bus252 days. A Source without it compounds by ended month.
type BusinessDayCompounding interface {
	CompoundsByBusinessDay() bool
}

// Calendared is implemented by a Source that publishes one rate each business day of a calendar of
// the registry: a business day between two rates without one is a hole (A265 RI3).
type Calendared interface {
	// Calendar is the identifier of the calendar, empty for none.
	Calendar() string
}

// HistoryStart is implemented by a Source whose index a security of its region counts from a date
// more than the default history back, such as the base of the VNA of a government bond: the store
// holds its rates from that date.
type HistoryStart interface {
	HistorySince() time.Time
}

// Source reads the rates of one index from one public source.
type Source interface {
	// ID identifies the source; it is the id of its marketdata_feed row.
	ID() string
	// Index is the identifier the rates are stored under, the index_id of the terms.
	Index() string
	// Period is PeriodDay or PeriodMonth.
	Period() string
	// Fetch returns the rates published for [from, to].
	Fetch(ctx context.Context, from, to time.Time) ([]Rate, error)
}

// KindOf is the kind of the index of src.
func KindOf(src Source) string {
	if k, ok := src.(Kinded); ok {
		return k.Kind()
	}

	return KindRate
}

// Level is the quote of an index on a date, a positive decimal.
type Level struct {
	Date  time.Time
	Value string
}

// Changes returns the rate of each level dated from on: its value over the one of the level before
// it, less one, rounded half to even to 12 decimals. The levels come oldest first.
func Changes(levels []Level, from time.Time) ([]Rate, error) {
	var out []Rate

	for i := 1; i < len(levels); i++ {
		if levels[i].Date.Before(from) {
			continue
		}

		prev, okPrev := new(big.Rat).SetString(levels[i-1].Value)

		cur, okCur := new(big.Rat).SetString(levels[i].Value)
		if !okPrev || !okCur || prev.Sign() <= 0 || cur.Sign() <= 0 {
			return out, fmt.Errorf(
				"level of %s or of the date before it is not a positive decimal",
				levels[i].Date.Format(time.DateOnly),
			)
		}

		change := cur.Sub(cur.Quo(cur, prev), big.NewRat(1, 1))
		out = append(out, Rate{Date: levels[i].Date, Value: roundHalfEven(change)})
	}

	return out, nil
}

// roundHalfEven writes r with 12 decimals, a tie to the even last digit.
func roundHalfEven(r *big.Rat) string {
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(decimals), nil)
	n := new(big.Int).Mul(r.Num(), scale)
	q, m := new(big.Int).QuoRem(n, r.Denom(), new(big.Int))

	twice := new(big.Int).Abs(new(big.Int).Lsh(m, 1))
	if c := twice.Cmp(r.Denom()); c > 0 || c == 0 && q.Bit(0) == 1 {
		q.Add(q, big.NewInt(int64(n.Sign())))
	}

	return new(big.Rat).SetFrac(q, scale).FloatString(decimals)
}
