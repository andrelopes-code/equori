package domain

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestDietzBP(t *testing.T) {
	t.Parallel()

	for _, c := range dietzCases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			bp, ok := DietzBP(day(c.start), day(c.end), c.startValue, c.result, c.flows)

			if bp != c.bp || ok != c.ok {
				t.Fatalf("DietzBP = %d, %v; want %d, %v", bp, ok, c.bp, c.ok)
			}
		})
	}
}

var dietzCases = []struct {
	name               string
	start, end         string
	startValue, result int64
	flows              []CashFlow
	bp                 int
	ok                 bool
}{
	{
		// 345.00 on 1,800.00 − 1,095.00 × 244/305 = 924.00: 37.3377%.
		name:       "sale inside the period",
		start:      "2025-12-31",
		end:        "2026-11-01",
		startValue: 180000,
		result:     34500,
		flows:      []CashFlow{{Date: day("2026-03-02"), Amount: -109500}},
		bp:         3734,
		ok:         true,
	},
	{
		// 150.00 on 1,000.00 × 355/365 = 972.60: 15.4225%.
		name:   "purchase inside the period",
		start:  "2024-12-31",
		end:    "2025-12-31",
		result: 15000,
		flows:  []CashFlow{{Date: day("2025-01-10"), Amount: 100000}},
		bp:     1542,
		ok:     true,
	},
	{
		// 0.5 bp exactly rounds to the even 0; 1.5 bp to 2.
		name: "tie to even", start: "2025-12-31", end: "2026-01-02",
		startValue: 2000000, result: 100, bp: 0, ok: true,
	},
	{
		name: "tie up to even", start: "2025-12-31", end: "2026-01-02",
		startValue: 2000000, result: 300, bp: 2, ok: true,
	},
	{
		name: "negative tie to even", start: "2025-12-31", end: "2026-01-02",
		startValue: 2000000, result: -300, bp: -2, ok: true,
	},
	{
		name: "nothing invested", start: "2025-12-31", end: "2026-12-31",
		result: 500, ok: false,
	},
}

// A purchase, a sale with fees and taxes and an income inside the period; a posting before it
// enters the start holding only.
func TestHoldingPeriods(t *testing.T) {
	t.Parallel()

	acct := uuid.New()
	f := Facts{
		Securities: []Security{{AccountID: acct, Instrument: "PETR4"}},
		Postings: []Posting{
			{AccountID: acct, Date: day("2025-01-10"), Quantity: 100, Weight: 200000},
			{AccountID: acct, Date: day("2026-03-02"), Quantity: -50, Weight: -100000},
			{AccountID: acct, Date: day("2026-04-01"), Quantity: 10, Weight: 21000},
			{AccountID: acct, Date: day("2027-01-05"), Quantity: 10, Weight: 21000},
		},
		Trades: []Trade{{
			AccountID: acct, Date: day("2026-03-02"), Side: "sell",
			Quantity: 50, Gross: 110000, Fees: 300, Taxes: 500, Cost: 100000,
		}},
		Incomes: []Income{
			{AccountID: acct, Date: day("2026-06-16"), Gross: 5000, Withheld: 750},
		},
	}

	got := HoldingPeriods(f, day("2025-12-31"), day("2026-12-31"))

	if len(got) != 1 {
		t.Fatalf("periods = %+v", got)
	}

	h := got[0]
	if h.Start != (Held{Quantity: 100, Cost: 200000}) ||
		h.End != (Held{Quantity: 60, Cost: 121000}) ||
		h.Realized != 9200 || h.Income != 4250 || !h.Active() {
		t.Fatalf("period = %+v", h)
	}

	flows := map[string]int64{}
	for _, c := range h.Flows {
		flows[c.Date.Format(time.DateOnly)] = c.Amount
	}

	// The sale takes out 1,100.00 − 3.00 − 5.00; the purchase puts in 210.00.
	if len(flows) != 2 || flows["2026-03-02"] != -109200 || flows["2026-04-01"] != 21000 {
		t.Fatalf("flows = %v", flows)
	}
}
