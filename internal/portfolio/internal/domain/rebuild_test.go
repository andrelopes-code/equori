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

func TestRebuild(t *testing.T) {
	t.Parallel()
	mxrf11, petr4 := uuid.New(), uuid.New()
	buy1, buy2, sale, dividend, jcp := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	f := Facts{
		Currency:   "BRL",
		Securities: []Security{{AccountID: mxrf11, Instrument: "MXRF11", TaxClass: "fii"}, {AccountID: petr4, Instrument: "PETR4", TaxClass: "stock"}},
		Postings: []Posting{
			{AccountID: mxrf11, TransactionID: buy1, Date: day("2026-10-05"), Quantity: 100, Weight: 100000},
			{AccountID: mxrf11, TransactionID: buy2, Date: day("2026-10-05"), Quantity: 50, Weight: 51240},
			{AccountID: mxrf11, TransactionID: sale, Date: day("2026-10-20"), Quantity: -50, Weight: -50413},
		},
		Trades: []Trade{
			{TransactionID: buy1, AccountID: mxrf11, Date: day("2026-10-05"), Side: "buy", Quantity: 100, Gross: 100000},
			{TransactionID: buy2, AccountID: mxrf11, Date: day("2026-10-05"), Side: "buy", Quantity: 50, Gross: 50750, Fees: 490},
			{TransactionID: sale, AccountID: mxrf11, Date: day("2026-10-20"), Side: "sell", Quantity: 50, Gross: 54000, Fees: 210, Cost: 50413},
		},
		Incomes: []Income{
			{TransactionID: dividend, AccountID: mxrf11, Date: day("2026-10-26"), Type: "dividend", Gross: 1000},
			{TransactionID: jcp, AccountID: petr4, Date: day("2026-10-26"), Type: "jcp", Gross: 4500, Withheld: 675},
		},
	}
	got := Rebuild(f)

	wantDays := []PositionDay{
		{AccountID: mxrf11, Instrument: "MXRF11", Date: day("2026-10-05"), Quantity: 150, CostBasis: 151240},
		{AccountID: mxrf11, Instrument: "MXRF11", Date: day("2026-10-20"), Quantity: 100, CostBasis: 100827},
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
		TransactionID: sale, AccountID: mxrf11, Instrument: "MXRF11", Date: day("2026-10-20"), Month: day("2026-10-01"),
		Quantity: 50, Cost: 50413, Proceeds: 53790, Result: 3377, TaxClass: "fii", Currency: "BRL",
	}
	if len(got.Results) != 1 || got.Results[0] != wantResult {
		t.Fatalf("results = %+v", got.Results)
	}
	wantIncomes := []IncomeEvent{
		{TransactionID: dividend, AccountID: mxrf11, Instrument: "MXRF11", Date: day("2026-10-26"), Type: "dividend", TaxTreatment: TreatmentExempt, Gross: 1000, Currency: "BRL"},
		{TransactionID: jcp, AccountID: petr4, Instrument: "PETR4", Date: day("2026-10-26"), Type: "jcp", TaxTreatment: TreatmentExclusive, Gross: 4500, Withheld: 675, Currency: "BRL"},
	}
	if len(got.Incomes) != 2 || got.Incomes[0] != wantIncomes[0] || got.Incomes[1] != wantIncomes[1] {
		t.Fatalf("incomes = %+v", got.Incomes)
	}
}

func TestRebuildFullSaleKeepsAZeroRow(t *testing.T) {
	t.Parallel()
	a := uuid.New()
	got := Rebuild(Facts{
		Currency:   "BRL",
		Securities: []Security{{AccountID: a, Instrument: "MXRF11", TaxClass: "fii"}},
		Postings: []Posting{
			{AccountID: a, TransactionID: uuid.New(), Date: day("2026-10-05"), Quantity: 10, Weight: 1000},
			{AccountID: a, TransactionID: uuid.New(), Date: day("2026-10-06"), Quantity: -10, Weight: -1000},
		},
	})
	if len(got.Days) != 2 || got.Days[1].Quantity != 0 || got.Days[1].CostBasis != 0 {
		t.Fatalf("days = %+v", got.Days)
	}
}
