package domain

import (
	"errors"
	"fmt"
	"math/big"
	"time"
)

// errNoRates is the VNA of an index that holds no rate for its period.
var errNoRates = errors.New("no rate of the index for the period")

// VNA is the updated nominal value of one unit of a government bond whose base is 1,000.00: the
// product of 1 + rate over rates, rounded half to even to 16 decimals, times 1,000.00, truncated to
// 6 decimals (Tesouro Nacional, Metodologia de Cálculo dos Títulos Públicos Federais, table 3: the
// accumulated factor A16, the VNA T6). It is written with 12 decimals.
func VNA(rates []string) (string, error) {
	if len(rates) == 0 {
		return "", errNoRates
	}

	factor := big.NewRat(1, 1)

	for _, r := range rates {
		v, ok := new(big.Rat).SetString(r)
		if !ok {
			return "", fmt.Errorf("rate %q is not a decimal", r)
		}

		factor.Mul(factor, v.Add(v, big.NewRat(1, 1)))
	}

	rounded := roundRat(factor, 16)

	return truncRat(rounded.Mul(rounded, big.NewRat(1000, 1)), 6).FloatString(12), nil
}

// MonthlyRates are the rates of rates dated on the first day of each month from base to the month
// before d, the months a VNA on d counts; false when one of them is missing.
func MonthlyRates(rates []IndexRate, base, d time.Time) ([]string, bool) {
	end := time.Date(d.Year(), d.Month(), 1, 0, 0, 0, 0, time.UTC)

	var out []string

	want := base
	for _, r := range rates {
		if !r.Date.Before(end) {
			break
		}

		if !r.Date.Equal(want) {
			return nil, false
		}

		out = append(out, r.Rate)
		want = want.AddDate(0, 1, 0)
	}

	return out, want.Equal(end) && len(out) > 0
}

// BondInterest is the coupon of one unit of a bond: vna times the interest factor of the half
// year, truncated to 6 decimals (the same methodology), written with 12 decimals.
func BondInterest(vna, factor string) (string, error) {
	v, ok := new(big.Rat).SetString(vna)
	f, okF := new(big.Rat).SetString(factor)

	if !ok || !okF {
		return "", fmt.Errorf("vna %q or factor %q is not a decimal", vna, factor)
	}

	return truncRat(v.Mul(v, f), 6).FloatString(12), nil
}

// roundRat is r rounded half to even to places decimals.
func roundRat(r *big.Rat, places int) *big.Rat {
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(places)), nil)
	q, m := new(big.Int).QuoRem(new(big.Int).Mul(r.Num(), scale), r.Denom(), new(big.Int))

	twice := new(big.Int).Abs(new(big.Int).Lsh(m, 1))
	if c := twice.Cmp(r.Denom()); c > 0 || c == 0 && q.Bit(0) == 1 {
		q.Add(q, big.NewInt(int64(r.Sign())))
	}

	return new(big.Rat).SetFrac(q, scale)
}

// truncRat is r truncated toward zero to places decimals.
func truncRat(r *big.Rat, places int) *big.Rat {
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(places)), nil)
	q := new(big.Int).Quo(new(big.Int).Mul(r.Num(), scale), r.Denom())

	return new(big.Rat).SetFrac(q, scale)
}
