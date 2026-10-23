package domain

import "testing"

func TestAnnualReturnBP(t *testing.T) {
	t.Parallel()
	flow := func(d string, amount int64) CashFlow { return CashFlow{Date: day(d), Amount: amount} }
	tests := []struct {
		name   string
		flows  []CashFlow
		want   int
		wantOK bool
	}{
		// The expected rates were solved independently with 50-digit decimals; a day count of days/365.
		{"five per cent over 365 days", []CashFlow{flow("2025-10-31", -100000), flow("2026-10-31", 105000)}, 500, true},
		{"no change", []CashFlow{flow("2025-10-31", -100000), flow("2026-10-31", 100000)}, 0, true},
		{"ten per cent", []CashFlow{flow("2025-10-31", -100000), flow("2026-10-31", 110000)}, 1000, true},
		{"a loss", []CashFlow{flow("2025-10-31", -100000), flow("2026-10-31", 90000)}, -1000, true},
		{"a contribution inside the period", []CashFlow{flow("2025-10-31", -100000), flow("2026-04-30", -100000), flow("2026-10-31", 215000)}, 1005, true},
		{"a withdrawal inside the period", []CashFlow{flow("2025-10-31", -100000), flow("2026-04-30", 30000), flow("2026-10-31", 80000)}, 1172, true},
		{"flows out of order", []CashFlow{flow("2026-10-31", 105000), flow("2025-10-31", -100000)}, 500, true},
		{"one flow", []CashFlow{flow("2026-10-31", 105000)}, 0, false},
		{"nothing invested", []CashFlow{flow("2025-10-31", 0), flow("2026-10-31", 0)}, 0, false},
		{"nothing put in", []CashFlow{flow("2025-10-31", 100000), flow("2026-10-31", 105000)}, 0, false},
		{"total loss", []CashFlow{flow("2025-10-31", -100000), flow("2026-10-31", 0)}, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := AnnualReturnBP(tt.flows)
			if ok != tt.wantOK || (ok && got != tt.want) {
				t.Fatalf("AnnualReturnBP = %d, %v; want %d, %v", got, ok, tt.want, tt.wantOK)
			}
		})
	}
}
