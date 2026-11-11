package feed

import (
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestMatchListings(t *testing.T) {
	t.Parallel()

	all := []Listing{
		{Code: "PETR4"},
		{Code: "MXRF11", Name: "Maxi Renda"},
		{Code: "NTNBP.20350515", Name: "Tesouro IPCA+ 2035"},
		{Code: "XPET11", Name: "Petro Fund"},
	}

	tests := []struct {
		query string
		limit int
		want  []money.Currency
	}{
		{"pet", 20, []money.Currency{"PETR4", "XPET11"}},
		{"PET", 1, []money.Currency{"PETR4"}},
		{"ipca", 20, []money.Currency{"NTNBP.20350515"}},
		{"zz", 20, nil},
	}

	for _, tc := range tests {
		t.Run(tc.query, func(t *testing.T) {
			t.Parallel()

			var got []money.Currency
			for _, l := range MatchListings(all, tc.query, tc.limit) {
				got = append(got, l.Code)
			}

			if !slices.Equal(got, tc.want) {
				t.Fatalf("codes = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestListCache(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 11, 9, 10, 0, 0, 0, time.UTC)
	c := NewListCache(func() time.Time { return now })

	if list, ok := c.Fresh(); ok || list != nil {
		t.Fatalf("new cache: fresh = %v, %v", list, ok)
	}

	if c.Last() != nil {
		t.Fatalf("new cache: last = %v", c.Last())
	}

	c.Set([]Listing{{Code: "PETR4"}})

	now = time.Date(2026, 11, 10, 9, 59, 0, 0, time.UTC)

	if list, ok := c.Fresh(); !ok || len(list) != 1 || list[0].Code != "PETR4" {
		t.Fatalf("at 09:59: fresh = %v, %v", list, ok)
	}

	now = time.Date(2026, 11, 10, 10, 1, 0, 0, time.UTC)

	if _, ok := c.Fresh(); ok {
		t.Fatal("at 10:01: fresh = true, want false")
	}

	if last := c.Last(); len(last) != 1 || last[0].Code != "PETR4" {
		t.Fatalf("at 10:01: last = %v", last)
	}
}
