package domain

import (
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestExchangeItems(t *testing.T) {
	t.Parallel()

	a, b, move := uuid.New(), uuid.New(), uuid.New()
	day := func(month time.Month, d int) time.Time {
		return time.Date(2026, month, d, 0, 0, 0, 0, time.UTC)
	}
	post := func(
		tx, account uuid.UUID,
		date time.Time,
		amount, weight int64,
		remunerated, baseBalanced bool,
	) BalancePosting {
		return BalancePosting{
			TransactionID: tx, AccountID: account, Date: date, Amount: amount, Weight: weight,
			Remunerated: remunerated, BaseBalanced: baseBalanced,
		}
	}

	tests := []struct {
		name string
		in   []BalancePosting
		want []AbroadItem
	}{
		{
			name: "outflow dearer than the inflow",
			in: []BalancePosting{
				post(uuid.New(), a, day(1, 10), 100000, 500000, true, true),
				post(uuid.New(), a, day(4, 10), -100000, -550000, true, true),
			},
			want: []AbroadItem{{Year: 2026, Amount: 50000}},
		},
		{
			name: "average cost of two inflows",
			in: []BalancePosting{
				post(uuid.New(), a, day(1, 10), 100000, 500000, true, true),
				post(uuid.New(), a, day(2, 10), 100000, 600000, true, true),
				post(uuid.New(), a, day(4, 10), -100000, -580000, true, true),
				post(uuid.New(), a, day(5, 10), -100000, -540000, true, true),
			},
			want: []AbroadItem{
				{Year: 2026, Amount: 30000},
				{Year: 2026, Amount: -10000},
			},
		},
		{
			name: "transfer in the foreign currency moves the cost",
			in: []BalancePosting{
				post(uuid.New(), a, day(1, 10), 100000, 500000, true, true),
				post(move, a, day(2, 10), -100000, -100000, true, false),
				post(move, b, day(2, 10), 100000, 100000, true, false),
				post(uuid.New(), b, day(4, 10), -100000, -550000, true, true),
			},
			want: []AbroadItem{{Year: 2026, Amount: 50000}},
		},
		{
			name: "transfer from a balance that earns nothing carries its cost",
			in: []BalancePosting{
				post(uuid.New(), b, day(1, 10), 100000, 500000, false, true),
				post(move, b, day(2, 10), -100000, -100000, false, false),
				post(move, a, day(2, 10), 100000, 100000, true, false),
				post(uuid.New(), a, day(4, 10), -100000, -550000, true, true),
			},
			want: []AbroadItem{{Year: 2026, Amount: 50000}},
		},
		{
			name: "outflow of a balance that earns nothing gives no item",
			in: []BalancePosting{
				post(uuid.New(), b, day(1, 10), 100000, 500000, false, true),
				post(uuid.New(), b, day(4, 10), -100000, -550000, false, true),
			},
			want: nil,
		},
		{
			name: "tie of the cost removed rounds to even",
			in: []BalancePosting{
				post(uuid.New(), a, day(1, 10), 2, 5, true, true),
				post(uuid.New(), a, day(2, 10), -1, -4, true, true),
			},
			want: []AbroadItem{{Year: 2026, Amount: 2}},
		},
		{
			name: "account without yield",
			in: []BalancePosting{
				post(uuid.New(), a, day(1, 10), 100000, 500000, false, true),
				post(uuid.New(), a, day(4, 10), -100000, -550000, false, true),
			},
			want: nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := ExchangeItems(tc.in)
			if !slices.Equal(got, tc.want) {
				t.Errorf("ExchangeItems = %+v, want %+v", got, tc.want)
			}
		})
	}
}
