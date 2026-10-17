package postgres_test

import (
	"math/big"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
)

func TestRateOf(t *testing.T) {
	tests := []struct {
		name string
		in   pgtype.Numeric
		want string
	}{
		{name: "trailing zeros of numeric(30,12)", in: pgtype.Numeric{Int: big.NewInt(5500000000000), Exp: -12, Valid: true}, want: "5.5"},
		{name: "positive exponent", in: pgtype.Numeric{Int: big.NewInt(12), Exp: 2, Valid: true}, want: "1200"},
		{name: "twelve decimals", in: pgtype.Numeric{Int: big.NewInt(1), Exp: -12, Valid: true}, want: "0.000000000001"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r, err := postgres.RateOf(tt.in)
			if err != nil || r.String() != tt.want {
				t.Fatalf("RateOf = %v, %v", r, err)
			}
		})
	}
	for _, bad := range []pgtype.Numeric{{}, {NaN: true, Valid: true}, {Int: big.NewInt(0), Valid: true}} {
		if _, err := postgres.RateOf(bad); err == nil {
			t.Fatalf("RateOf(%+v) accepted", bad)
		}
	}
	r, _ := money.ParseRate("10.0827")
	back, err := postgres.RateOf(postgres.NumericOf(r))
	if err != nil || back != r {
		t.Fatalf("round trip = %v, %v", back, err)
	}
}
