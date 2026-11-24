package domain

import (
	"math/big"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func rate(t *testing.T, s string) money.Rate {
	t.Helper()

	r, err := money.ParseRate(s)
	if err != nil {
		t.Fatal(err)
	}

	return r
}

// SA4: a price is divided by the ratio of each later split.
func TestAdjusted(t *testing.T) {
	t.Parallel()

	day := func(y, m, d int) time.Time {
		return time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC)
	}
	splits := []Split{
		{Date: day(2007, 6, 4), Ratio: big.NewRat(1, 125)},
		{Date: day(2026, 4, 29), Ratio: big.NewRat(5, 1)},
	}

	for name, tt := range map[string]struct {
		value string
		date  time.Time
		want  string
		ok    bool
	}{
		"before both":        {"0.31", day(2007, 6, 1), "7.75", true},
		"between them":       {"170", day(2026, 4, 28), "34", true},
		"on the first day":   {"33.97", day(2026, 4, 29), "33.97", false},
		"after both":         {"34.1", day(2026, 5, 4), "34.1", false},
		"a tie rounds even":  {"0.000000125", day(2026, 4, 28), "0.00000002", true},
		"under the decimals": {"0.000000001", day(2026, 4, 28), "0.000000001", false},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got, ok := Adjusted(rate(t, tt.value), tt.date, splits)
			if ok != tt.ok || got.String() != tt.want {
				t.Errorf("adjusted = %s, %v, want %s, %v", got, ok, tt.want, tt.ok)
			}
		})
	}
}

// SA3: the closes of the B3 around known events.
func TestConfirmsSplit(t *testing.T) {
	t.Parallel()

	for name, tt := range map[string]struct {
		before, after string
		ratio         *big.Rat
		want          bool
	}{
		"SBSP3 1:125 in 2007":       {"0.315", "39.2", big.NewRat(1, 125), true},
		"KNRI11 10:1 in 2014":       {"1200", "118.7", big.NewRat(10, 1), true},
		"a bonus of 10%":            {"20.1", "18.2", big.NewRat(11, 10), true},
		"ABEV3, the former share":   {"17.1", "16.8", big.NewRat(5, 1), false},
		"a split read upside down":  {"1200", "118.7", big.NewRat(1, 10), false},
		"a split that did not come": {"50", "49", big.NewRat(2, 1), false},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if got := ConfirmsSplit(
				rate(t, tt.before),
				rate(t, tt.after),
				tt.ratio,
			); got != tt.want {
				t.Errorf("confirmed = %v, want %v", got, tt.want)
			}
		})
	}
}
