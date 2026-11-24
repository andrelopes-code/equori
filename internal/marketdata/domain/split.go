package domain

import (
	"math/big"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// adjustedDecimals are the decimals of an adjusted price (A266 SA4).
const adjustedDecimals = 8

// confirmLow and confirmHigh bound the jump of the closes at a split once its ratio is taken out
// (A266 SA3).
var (
	confirmLow  = big.NewRat(75, 100)
	confirmHigh = big.NewRat(133, 100)
)

// Split is the first session of an instrument in new units and the units after it for each unit before
// it (A266 SA1).
type Split struct {
	Date  time.Time
	Ratio *big.Rat
}

// Adjusted is value, the price of date, in the units of after every split; false when no split is
// later than date.
func Adjusted(value money.Rate, date time.Time, splits []Split) (money.Rate, bool) {
	factor := big.NewRat(1, 1)
	later := false

	for _, s := range splits {
		if s.Date.After(date) {
			factor.Mul(factor, s.Ratio)

			later = true
		}
	}

	if !later {
		return value, false
	}

	r, _ := new(big.Rat).SetString(value.String())

	text := roundHalfEven(r.Quo(r, factor), adjustedDecimals)
	if strings.Contains(text, ".") {
		text = strings.TrimSuffix(strings.TrimRight(text, "0"), ".")
	}

	adjusted, err := money.ParseRate(text)
	if err != nil {
		// Under 10^-8, or over what a rate holds: the traded price is the only exact one.
		return value, false
	}

	return adjusted, true
}

// ConfirmsSplit reports whether the closes around a split, the last before it and the first in new
// units, moved by its ratio.
func ConfirmsSplit(before, after money.Rate, ratio *big.Rat) bool {
	x, _ := new(big.Rat).SetString(after.String())
	b, _ := new(big.Rat).SetString(before.String())
	x.Quo(x, b).Mul(x, ratio)

	return x.Cmp(confirmLow) >= 0 && x.Cmp(confirmHigh) <= 0
}

// roundHalfEven writes a positive r with places decimals, a tie to the even last digit.
func roundHalfEven(r *big.Rat, places int) string {
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(places)), nil)
	q, m := new(big.Int).QuoRem(new(big.Int).Mul(r.Num(), scale), r.Denom(), new(big.Int))

	if c := new(big.Int).Lsh(m, 1).Cmp(r.Denom()); c > 0 || c == 0 && q.Bit(0) == 1 {
		q.Add(q, big.NewInt(1))
	}

	return new(big.Rat).SetFrac(q, scale).FloatString(places)
}
