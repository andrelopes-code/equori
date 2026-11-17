package domain

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}

// fixtureJurisdiction stands in for a real jurisdiction: the domain does not import them.
type fixtureJurisdiction struct{}

func (fixtureJurisdiction) ID() string            { return "fixture" }
func (fixtureJurisdiction) IncomeTypes() []string { return nil }

func (fixtureJurisdiction) Subtypes(string) []string                { return nil }
func (fixtureJurisdiction) TaxYear(year int) (time.Time, time.Time) { return CalendarYear(year) }
func (fixtureJurisdiction) Guarantee() (Guarantee, bool)            { return Guarantee{}, false }
func (fixtureJurisdiction) UnitTax() (UnitTax, bool)                { return UnitTax{}, false }

func (fixtureJurisdiction) TaxClass(instrumentType, _, exchange string) string {
	if instrumentType == "reit" && exchange == "BVMF" {
		return "fii"
	}

	return instrumentType
}

func (fixtureJurisdiction) Treatment(incomeType, _ string) string {
	if incomeType == "dividend" {
		return "exempt"
	}

	return "exclusive"
}

func TestRebuild(t *testing.T) {
	t.Parallel()

	mxrf11, petr4 := uuid.New(), uuid.New()
	buy1, buy2, sale, dividend, jcp := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	f := Facts{
		Currency: "BRL",
		Securities: []Security{
			{AccountID: mxrf11, Instrument: "MXRF11", Type: "reit", Exchange: "BVMF"},
			{AccountID: petr4, Instrument: "PETR4", Type: "stock", Exchange: "BVMF"},
		},
		Postings: []Posting{
			{
				AccountID:     mxrf11,
				TransactionID: buy1,
				Date:          day("2026-10-05"),
				Quantity:      100,
				Weight:        100000,
			},
			{
				AccountID:     mxrf11,
				TransactionID: buy2,
				Date:          day("2026-10-05"),
				Quantity:      50,
				Weight:        51240,
			},
			{
				AccountID:     mxrf11,
				TransactionID: sale,
				Date:          day("2026-10-20"),
				Quantity:      -50,
				Weight:        -50413,
			},
		},
		Trades: []Trade{
			{
				TransactionID: buy1,
				AccountID:     mxrf11,
				Date:          day("2026-10-05"),
				Side:          "buy",
				Quantity:      100,
				Gross:         100000,
			},
			{
				TransactionID: buy2,
				AccountID:     mxrf11,
				Date:          day("2026-10-05"),
				Side:          "buy",
				Quantity:      50,
				Gross:         50750,
				Fees:          490,
			},
			{
				TransactionID: sale,
				AccountID:     mxrf11,
				Date:          day("2026-10-20"),
				Side:          "sell",
				Quantity:      50,
				Gross:         54000,
				Fees:          210,
				Cost:          50413,
			},
		},
		Incomes: []Income{
			{
				TransactionID: dividend,
				AccountID:     mxrf11,
				Date:          day("2026-10-26"),
				Type:          "dividend",
				Gross:         1000,
			},
			{
				TransactionID: jcp,
				AccountID:     petr4,
				Date:          day("2026-10-26"),
				Type:          "jcp",
				Gross:         4500,
				Withheld:      675,
			},
		},
	}
	got := Rebuild(f, fixtureJurisdiction{})

	wantDays := []PositionDay{
		{
			AccountID:  mxrf11,
			Instrument: "MXRF11",
			Date:       day("2026-10-05"),
			Quantity:   150,
			CostBasis:  151240,
		},
		{
			AccountID:  mxrf11,
			Instrument: "MXRF11",
			Date:       day("2026-10-20"),
			Quantity:   100,
			CostBasis:  100827,
		},
	}
	if len(got.Days) != len(wantDays) {
		t.Fatalf("days = %+v", got.Days)
	}

	for i, w := range wantDays {
		if got.Days[i] != w {
			t.Fatalf("day %d = %+v, want %+v", i, got.Days[i], w)
		}
	}

	wantResult := RealizedResult{
		TransactionID: sale,
		AccountID:     mxrf11,
		Instrument:    "MXRF11",
		Date:          day("2026-10-20"),
		Month:         day("2026-10-01"),
		Quantity:      50,
		Cost:          50413,
		Proceeds:      53790,
		Result:        3377,
		Kind:          "swing",
		TaxClass:      "fii",
		Currency:      "BRL",
	}
	if len(got.Results) != 1 || got.Results[0] != wantResult {
		t.Fatalf("results = %+v", got.Results)
	}

	wantIncomes := []IncomeEvent{
		{
			TransactionID: dividend,
			AccountID:     mxrf11,
			Instrument:    "MXRF11",
			Date:          day("2026-10-26"),
			Type:          "dividend",
			TaxTreatment:  "exempt",
			Gross:         1000,
			Currency:      "BRL",
		},
		{
			TransactionID: jcp,
			AccountID:     petr4,
			Instrument:    "PETR4",
			Date:          day("2026-10-26"),
			Type:          "jcp",
			TaxTreatment:  "exclusive",
			Gross:         4500,
			Withheld:      675,
			Currency:      "BRL",
		},
	}
	if len(got.Incomes) != 2 || got.Incomes[0] != wantIncomes[0] ||
		got.Incomes[1] != wantIncomes[1] {
		t.Fatalf("incomes = %+v", got.Incomes)
	}
}

// A228 IO15: a sale gives a day_trade row and a swing row; proceeds split half to even.
func TestRebuildSplitsASaleByKind(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name                  string
		quantity, gross, cost int64
		dtQuantity, dtCost    int64
		want                  []RealizedResult
	}{
		{
			name: "day trade and swing", quantity: 50, gross: 65000, cost: 56000,
			dtQuantity: 30, dtCost: 36000,
			want: []RealizedResult{
				{Kind: "day_trade", Quantity: 30, Cost: 36000, Proceeds: 39000, Result: 3000},
				{Kind: "swing", Quantity: 20, Cost: 20000, Proceeds: 26000, Result: 6000},
			},
		},
		{
			name: "no day trade", quantity: 50, gross: 65000, cost: 56000,
			want: []RealizedResult{
				{Kind: "swing", Quantity: 50, Cost: 56000, Proceeds: 65000, Result: 9000},
			},
		},
		{
			name: "all day trade", quantity: 50, gross: 65000, cost: 60000,
			dtQuantity: 50, dtCost: 60000,
			want: []RealizedResult{
				{Kind: "day_trade", Quantity: 50, Cost: 60000, Proceeds: 65000, Result: 5000},
			},
		},
		{
			name: "rounding", quantity: 3, gross: 1000, cost: 900,
			dtQuantity: 1, dtCost: 300,
			want: []RealizedResult{
				{Kind: "day_trade", Quantity: 1, Cost: 300, Proceeds: 333, Result: 33},
				{Kind: "swing", Quantity: 2, Cost: 600, Proceeds: 667, Result: 67},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			a, sale := uuid.New(), uuid.New()
			got := Rebuild(Facts{
				Currency: "BRL",
				Securities: []Security{
					{AccountID: a, Instrument: "PETR4", Type: "stock", Exchange: "BVMF"},
				},
				Postings: []Posting{
					{
						AccountID:     a,
						TransactionID: uuid.New(),
						Date:          day("2026-11-03"),
						Quantity:      100,
						Weight:        100000,
					},
					{
						AccountID:     a,
						TransactionID: sale,
						Date:          day("2026-11-10"),
						Quantity:      -tt.quantity,
						Weight:        -tt.cost,
					},
				},
				Trades: []Trade{{
					TransactionID: sale, AccountID: a, Date: day("2026-11-10"), Side: "sell",
					Quantity: tt.quantity, Gross: tt.gross, Cost: tt.cost,
					DayTradeQuantity: tt.dtQuantity, DayTradeCost: tt.dtCost,
				}},
			}, fixtureJurisdiction{})

			if len(got.Results) != len(tt.want) {
				t.Fatalf("results = %+v", got.Results)
			}

			for i, w := range tt.want {
				r := got.Results[i]
				if r.Kind != w.Kind || r.Quantity != w.Quantity || r.Cost != w.Cost ||
					r.Proceeds != w.Proceeds || r.Result != w.Result || r.TransactionID != sale {
					t.Fatalf("result %d = %+v, want %+v", i, r, w)
				}
			}
		})
	}
}

func TestRebuildFullSaleKeepsAZeroRow(t *testing.T) {
	t.Parallel()

	a := uuid.New()

	got := Rebuild(Facts{
		Currency: "BRL",
		Securities: []Security{
			{AccountID: a, Instrument: "MXRF11", Type: "reit", Exchange: "BVMF"},
		},
		Postings: []Posting{
			{
				AccountID:     a,
				TransactionID: uuid.New(),
				Date:          day("2026-10-05"),
				Quantity:      10,
				Weight:        1000,
			},
			{
				AccountID:     a,
				TransactionID: uuid.New(),
				Date:          day("2026-10-06"),
				Quantity:      -10,
				Weight:        -1000,
			},
		},
	}, fixtureJurisdiction{})
	if len(got.Days) != 2 || got.Days[1].Quantity != 0 || got.Days[1].CostBasis != 0 {
		t.Fatalf("days = %+v", got.Days)
	}
}

func TestRebuildWithoutJurisdiction(t *testing.T) {
	t.Parallel()

	a, sale, dividend := uuid.New(), uuid.New(), uuid.New()

	got := Rebuild(Facts{
		Currency:   "EUR",
		Securities: []Security{{AccountID: a, Instrument: "SAP", Type: "stock", Exchange: "XETR"}},
		Trades: []Trade{
			{
				TransactionID: sale,
				AccountID:     a,
				Date:          day("2026-10-20"),
				Side:          "sell",
				Quantity:      1,
				Gross:         200,
				Cost:          100,
			},
		},
		Incomes: []Income{
			{
				TransactionID: dividend,
				AccountID:     a,
				Date:          day("2026-10-26"),
				Type:          "dividend",
				Gross:         10,
			},
		},
	}, nil)
	if len(got.Results) != 1 || got.Results[0].TaxClass != "" {
		t.Fatalf("results = %+v", got.Results)
	}

	if len(got.Incomes) != 1 || got.Incomes[0].TaxTreatment != "" {
		t.Fatalf("incomes = %+v", got.Incomes)
	}
}
