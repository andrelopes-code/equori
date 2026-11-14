package domain

import (
	"math/big"
	"slices"
	"testing"
)

func TestApportion(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		amount  int64
		weights []int64
		want    []int64
	}{
		{"two orders", 251, []int64{300000, 300500}, []int64{125, 126}},
		{"tie goes to the lower index", 100, []int64{1, 1, 1}, []int64{34, 33, 33}},
		{"zero amount", 0, []int64{5, 7}, []int64{0, 0}},
		{"zero weights", 10, []int64{0, 0}, []int64{0, 0}},
		{"zero weight takes nothing", 7, []int64{0, 3, 0, 4}, []int64{0, 3, 0, 4}},
		{"one unit", 1, []int64{1, 1}, []int64{1, 0}},
		{"one weight", 9, []int64{4}, []int64{9}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			got := Apportion(c.amount, c.weights)
			if !slices.Equal(got, c.want) {
				t.Fatalf("Apportion(%d, %v) = %v, want %v", c.amount, c.weights, got, c.want)
			}
		})
	}
}

func TestApportionAvoidsOverflow(t *testing.T) {
	t.Parallel()

	const amount = 9007199254740991

	sum := big.NewInt(amount + 1)
	product := new(big.Int).Mul(big.NewInt(amount), big.NewInt(amount))
	floor := new(big.Int).Div(product, sum)

	got := Apportion(amount, []int64{amount, 1})

	if got[0]+got[1] != amount {
		t.Fatalf("sum = %d, want %d", got[0]+got[1], amount)
	}

	// The second weight holds the larger remainder, so it takes the one unit left.
	if got[0] != floor.Int64() || got[1] != 1 {
		t.Fatalf("shares = %v, want [%s 1]", got, floor)
	}
}
