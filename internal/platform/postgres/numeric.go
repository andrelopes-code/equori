package postgres

import (
	"fmt"
	"math/big"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// NumericOf maps a rate to numeric(30,12) (ADR 005).
func NumericOf(r money.Rate) pgtype.Numeric {
	return pgtype.Numeric{Int: big.NewInt(r.Mantissa()), Exp: -int32(r.Scale()), Valid: true} //nolint:gosec // G115: a rate scale is 0–12
}

// RateOf reads a numeric without its trailing zeros: numeric(30,12) stores 5.5 as 5.500000000000.
func RateOf(n pgtype.Numeric) (money.Rate, error) {
	if !n.Valid || n.NaN || n.Int == nil {
		return money.Rate{}, fmt.Errorf("read rate: %w", money.ErrInvalidRate)
	}
	m, exp := new(big.Int).Set(n.Int), n.Exp
	ten := big.NewInt(10)
	for ; exp > 0; exp-- {
		m.Mul(m, ten)
	}
	for mod := new(big.Int); exp < 0; exp++ {
		q, r := new(big.Int).QuoRem(m, ten, mod)
		if r.Sign() != 0 {
			break
		}
		m = q
	}
	if !m.IsInt64() {
		return money.Rate{}, fmt.Errorf("read rate %s: %w", m, money.ErrInvalidRate)
	}
	return money.NewRate(m.Int64(), int(-exp))
}
