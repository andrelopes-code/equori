package client

import (
	"errors"
	"fmt"
	"math/big"
)

var ErrAmount = errors.New("invalid amount")

// maxMinor is the largest amount the ledger stores (2^53 − 1 minor units).
const maxMinor = 1<<53 - 1

// Minor converts the text of a JSON number to minor units with scale decimals, exactly
// (P6 amendment A37); more decimals than scale is an error.
func Minor(d Decimal, scale int) (int64, error) {
	r, ok := new(big.Rat).SetString(string(d))
	if d == "" || !ok {
		return 0, fmt.Errorf("%w: %q", ErrAmount, string(d))
	}
	r.Mul(r, new(big.Rat).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(scale)), nil)))
	if !r.IsInt() {
		return 0, fmt.Errorf("%w: %q has more than %d decimals", ErrAmount, string(d), scale)
	}
	n := r.Num()
	if !n.IsInt64() || n.Int64() > maxMinor || n.Int64() < -maxMinor {
		return 0, fmt.Errorf("%w: %q is out of range", ErrAmount, string(d))
	}
	return n.Int64(), nil
}

// Rounded reads a decimal into minor units rounded half away from zero: a bill total carries
// more decimals than the currency (Nubank: 784.6535 for 784.65).
func Rounded(d Decimal, scale int) (int64, error) {
	r, ok := new(big.Rat).SetString(string(d))
	if d == "" || !ok {
		return 0, fmt.Errorf("%w: %q", ErrAmount, string(d))
	}
	r.Mul(r, new(big.Rat).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(scale)), nil)))
	half := big.NewRat(1, 2)
	if r.Sign() < 0 {
		half.Neg(half)
	}
	n := new(big.Int).Quo(new(big.Rat).Add(r, half).Num(), new(big.Rat).Add(r, half).Denom())
	if !n.IsInt64() || n.Int64() > maxMinor || n.Int64() < -maxMinor {
		return 0, fmt.Errorf("%w: %q is out of range", ErrAmount, string(d))
	}
	return n.Int64(), nil
}
