// Package totalreturn reads the total return of a foreign equity index from the Yahoo chart API,
// checked session by session against the price return.
package totalreturn

import (
	"context"
	"fmt"
	"math/big"
	"net/http"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed/yahoochart"
	"github.com/andrelopes-code/equori/internal/marketdata/index"
)

const (
	// reachDays reaches the sessions before the first day asked: the change of that day needs one,
	// and the check needs its neighbors.
	reachDays = 30
	// neighbors is the number of sessions on each side a ratio is compared with (A265 MI4).
	neighbors = 3
	// levelDecimals is the precision of a level.
	levelDecimals = 12
)

// Source is one total return index seen as a daily index source.
type Source struct {
	hc    *http.Client
	base  string
	id    string
	index string
	now   func() time.Time

	// price is the symbol of the price closes; total is the symbol of the total return closes,
	// empty when they are the adjusted closes of price.
	price, total string
	// step is the largest distribution of one session, a fraction of the price.
	step *big.Rat
	// since is the first day of the index, zero for no bound.
	since time.Time
}

// SP500 is the S&P 500 total return (identifier us_sp500, index sp500), in dollars.
func SP500(hc *http.Client, base string, now func() time.Time) Source {
	return Source{
		hc:    hc,
		base:  base,
		id:    "us_sp500",
		index: "sp500",
		now:   now,
		price: "^GSPC",
		total: "^SP500TR",
		step:  big.NewRat(12, 10000),
	}
}

// FTSEGlobal is the FTSE Global All Cap (identifier global_ftse, index ftse_global), in dollars,
// through the ETF VT with its distributions reinvested: the index publishes no history. VT followed
// another index before 2011-12-19.
func FTSEGlobal(hc *http.Client, base string, now func() time.Time) Source {
	return Source{
		hc:    hc,
		base:  base,
		id:    "global_ftse",
		index: "ftse_global",
		now:   now,
		price: "VT",
		step:  big.NewRat(3, 100),
		since: time.Date(2011, time.December, 19, 0, 0, 0, 0, time.UTC),
	}
}

func (s Source) ID() string     { return s.id }
func (s Source) Index() string  { return s.index }
func (s Source) Period() string { return index.PeriodDay }
func (s Source) Kind() string   { return index.KindMarket }

// Fetch returns the change of each session of [from, to] from the session before it.
func (s Source) Fetch(ctx context.Context, from, to time.Time) ([]index.Rate, error) {
	if from.Before(s.since) {
		from = s.since
	}

	if to.Before(from) {
		return nil, nil
	}

	price, total, err := s.read(ctx, from.AddDate(0, 0, -reachDays), to)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", s.id, err)
	}

	levels, err := s.levels(price, total)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", s.id, err)
	}

	rates, err := index.Changes(levels, from)
	if err != nil {
		return rates, fmt.Errorf("%s: %w", s.id, err)
	}

	return rates, nil
}

// read returns the price closes, oldest first, and the total return closes by date.
func (s Source) read(
	ctx context.Context,
	from, to time.Time,
) ([]yahoochart.Close, map[time.Time]string, error) {
	price, err := yahoochart.Closes(ctx, s.hc, s.base, s.price, from, to, s.now())
	if err != nil {
		return nil, nil, err
	}

	byDate := make(map[time.Time]string, len(price))

	if s.total == "" {
		for _, c := range price {
			byDate[c.Date] = c.Adjusted
		}

		return price, byDate, nil
	}

	total, err := yahoochart.Closes(ctx, s.hc, s.base, s.total, from, to, s.now())
	if err != nil {
		return nil, nil, err
	}

	for _, c := range total {
		byDate[c.Date] = c.Value
	}

	return price, byDate, nil
}

// levels returns the total return level of each session of price. The ratio of the total return to
// the price grows by the distributions alone, so a ratio away from the median of its neighbors is a
// wrong close: the session takes the median, as one without a total return close does (A265 MI4).
func (s Source) levels(
	price []yahoochart.Close,
	total map[time.Time]string,
) ([]index.Level, error) {
	closes, ratios, err := ratiosOf(price, total)
	if err != nil {
		return nil, err
	}

	var (
		out  []index.Level
		prev *big.Rat
	)

	for i, c := range price {
		typical := median(ratios[max(0, i-neighbors):min(len(ratios), i+neighbors+1)])
		if typical == nil {
			continue
		}

		if prev != nil && !within(typical, prev, tolerance, s.step) {
			return nil, fmt.Errorf(
				"total return against the price of %s is not the one of the session before",
				c.Date.Format(time.DateOnly),
			)
		}

		prev = typical

		ratio := ratios[i]
		if ratio == nil || !s.plausible(ratio, typical, i, len(ratios)) {
			ratio = typical
		}

		level := new(big.Rat).Mul(ratio, closes[i])
		out = append(out, index.Level{Date: c.Date, Value: level.FloatString(levelDecimals)})
	}

	return out, nil
}

// ratiosOf returns the price closes and the ratio of the total return to each, nil without one.
func ratiosOf(
	price []yahoochart.Close,
	total map[time.Time]string,
) ([]*big.Rat, []*big.Rat, error) {
	closes := make([]*big.Rat, len(price))
	ratios := make([]*big.Rat, len(price))

	for i, c := range price {
		cur, ok := new(big.Rat).SetString(c.Value)
		if !ok || cur.Sign() <= 0 {
			return nil, nil, fmt.Errorf("close %q is not a positive decimal", c.Value)
		}

		closes[i] = cur

		if level, ok := new(big.Rat).SetString(total[c.Date]); ok {
			ratios[i] = level.Quo(level, cur)
		}
	}

	return closes, ratios, nil
}

// median is the median of the known ratios, the lower of two middle ones, nil without any.
func median(ratios []*big.Rat) *big.Rat {
	known := slices.DeleteFunc(slices.Clone(ratios), func(r *big.Rat) bool { return r == nil })
	if len(known) == 0 {
		return nil
	}

	slices.SortFunc(known, (*big.Rat).Cmp)

	return known[(len(known)-1)/2]
}

// tolerance is the largest difference between a ratio and the median of its neighbors that rounding
// explains.
var tolerance = big.NewRat(3, 10000)

// plausible reports whether the ratio of session i of n is the median of its neighbors. A session
// without all of its neighbors on one side can hold a distribution that the median does not.
func (s Source) plausible(ratio, typical *big.Rat, i, n int) bool {
	low, high := tolerance, tolerance

	if i < neighbors {
		low = s.step
	}

	if i >= n-neighbors {
		high = s.step
	}

	return within(ratio, typical, low, high)
}

// within reports whether r over base, less 1, lies in [-low, high].
func within(r, base, low, high *big.Rat) bool {
	change := new(big.Rat).Sub(new(big.Rat).Quo(r, base), big.NewRat(1, 1))

	return change.Cmp(new(big.Rat).Neg(low)) >= 0 && change.Cmp(high) <= 0
}
