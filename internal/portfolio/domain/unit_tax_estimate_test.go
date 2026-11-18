package domain

import "testing"

func TestUnitTaxEstimate(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name            string
		now, cost, prev int64
		rate            int
		want            int64
	}{
		{"gain over cost", 1050000, 1000000, 0, 2000, 10000},
		{"gain over the previous value", 1080000, 1000000, 1050000, 1500, 4500},
		{"loss", 990000, 1000000, 0, 1500, 0},
		{"tie to even", 1000001, 1000000, 0, 5000, 0},
	} {
		if got := UnitTaxEstimate(tc.now, tc.cost, tc.prev, tc.rate); got != tc.want {
			t.Errorf("%s: UnitTaxEstimate = %d, want %d", tc.name, got, tc.want)
		}
	}
}
