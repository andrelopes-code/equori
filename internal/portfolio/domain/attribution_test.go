package domain

import (
	"math/big"
	"slices"
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

	// The sale takes out 1,100.00 − 3.00 − 5.00; the purchase puts in 210.00; the income takes out
	// 50.00 − 7.50.
	if len(flows) != 3 || flows["2026-03-02"] != -109200 || flows["2026-04-01"] != 21000 ||
		flows["2026-06-16"] != -4250 {
		t.Fatalf("flows = %v", flows)
	}
}

func TestIndexedResult(t *testing.T) {
	t.Parallel()

	onePercent := func(time.Time) float64 { return 1.01 }

	// 1,000.00 grows 1% a day for two days: 1,020.10.
	if got := IndexedResult(
		day("2025-12-31"),
		day("2026-01-02"),
		100000,
		nil,
		onePercent,
	); got != 2010 {
		t.Fatalf("no flow = %d, want 2010", got)
	}

	// 500.00 in on the first day earns from the second: 1,010.00 + 500.00, then 1%: 1,525.10.
	flows := []CashFlow{{Date: day("2026-01-01"), Amount: 50000}}
	if got := IndexedResult(
		day("2025-12-31"),
		day("2026-01-02"),
		100000,
		flows,
		onePercent,
	); got != 2510 {
		t.Fatalf("with a flow = %d, want 2510", got)
	}

	// A flow after until is left out.
	late := []CashFlow{{Date: day("2026-01-03"), Amount: 50000}}
	if got := IndexedResult(
		day("2025-12-31"),
		day("2026-01-02"),
		100000,
		late,
		onePercent,
	); got != 2010 {
		t.Fatalf("late flow = %d, want 2010", got)
	}
}

func TestSharesBP(t *testing.T) {
	t.Parallel()

	r := func(n, d int64) *big.Rat { return big.NewRat(n, d) }

	tests := []struct {
		name  string
		parts []*big.Rat
		total int
		want  []int
	}{
		// 3333.33 three times: the floors give 9999, the first remainder takes the unit.
		{
			"thirds",
			[]*big.Rat{r(10000, 3), r(10000, 3), r(10000, 3)},
			10000,
			[]int{3334, 3333, 3333},
		},
		// 150.6 and -20.4 add to 130.2, rounded 130: floors 150 and -21 give 129.
		{"negative part", []*big.Rat{r(1506, 10), r(-204, 10)}, 130, []int{151, -21}},
		{"exact", []*big.Rat{r(100, 1), r(-30, 1)}, 70, []int{100, -30}},
	}

	for _, tc := range tests {
		got := SharesBP(tc.parts, tc.total)
		if !slices.Equal(got, tc.want) {
			t.Fatalf("%s: SharesBP = %v, want %v", tc.name, got, tc.want)
		}
	}
}
