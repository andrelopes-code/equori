package br

import (
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

func month(m time.Month) time.Time { return time.Date(2026, m, 1, 0, 0, 0, 0, time.UTC) }

// Monthly gain tax design GT1 to GT5, in cents. S628: January sells R$ 15,000.00 of stocks with a
// gain of R$ 2,000.00, exempt, and loses R$ 500.00 on an ETF; February spends that loss against a
// stock gain of R$ 3,000.00. S629: a day trade of March owes R$ 7.60, below the minimum, which the
// DARF of April carries; the FII gain of May pays 20%.
func TestGainTax(t *testing.T) {
	t.Parallel()

	sales := []domain.TaxSale{
		{
			Month:    month(time.January),
			Kind:     "swing",
			TaxClass: "stock",
			Gross:    1500000,
			Result:   200000,
		},
		{Month: month(time.January), Kind: "swing", TaxClass: "etf", Gross: 400000, Result: -50000},
		{
			Month:    month(time.February),
			Kind:     "swing",
			TaxClass: "stock",
			Gross:    3000000,
			Result:   300000,
			Withheld: 150,
		},
		{
			Month:    month(time.March),
			Kind:     "day_trade",
			TaxClass: "stock",
			Gross:    500000,
			Result:   4000,
			Withheld: 40,
		},
		{
			Month:    month(time.April),
			Kind:     "day_trade",
			TaxClass: "option",
			Gross:    300000,
			Result:   10000,
			Withheld: 100,
		},
		{Month: month(time.May), Kind: "swing", TaxClass: "fii", Gross: 1000000, Result: 100000},
		{
			Month:    month(time.May),
			Kind:     "swing",
			TaxClass: "fixed_income",
			Gross:    900000,
			Result:   90000,
		},
	}

	got := New().GainTax(sales)

	want := map[time.Month]struct {
		pool                    string
		exempt, used, base, tax int64
		due, darf, carriedIn    int64
	}{
		time.January:  {domain.PoolOrdinary, 200000, 0, 0, 0, 0, 0, 0},
		time.February: {domain.PoolOrdinary, 0, 50000, 250000, 37500, 37350, 37350, 0},
		time.March:    {domain.PoolDayTrade, 0, 0, 4000, 800, 760, 0, 0},
		time.April:    {domain.PoolDayTrade, 0, 0, 10000, 2000, 1900, 2660, 760},
		time.May:      {domain.PoolFII, 0, 0, 100000, 20000, 20000, 20000, 0},
	}

	if len(got) != len(want) {
		t.Fatalf("months = %d, want %d: %+v", len(got), len(want), got)
	}

	for _, m := range got {
		w := want[m.Month.Month()]
		if len(m.Lines) != 1 {
			t.Fatalf("%s lines = %+v, want one", m.Month.Format("2006-01"), m.Lines)
		}

		l := m.Lines[0]
		if l.Pool != w.pool || l.Exempt != w.exempt || l.LossUsed != w.used || l.Base != w.base ||
			l.Tax != w.tax || l.Due != w.due || m.Darf != w.darf || m.CarriedIn != w.carriedIn {
			t.Errorf(
				"%s = %+v darf %d carried %d, want %+v",
				m.Month.Format("2006-01"),
				l,
				m.Darf,
				m.CarriedIn,
				w,
			)
		}
	}

	if jan := got[0].Lines[0]; jan.LossCarried != 50000 || jan.RateBP != 1500 {
		t.Errorf("January = %+v, want 500.00 of loss carried at 15%%", jan)
	}
}

// GT2: the exemption reads the gross sales of stocks only; an ETF sale of any size keeps its gain
// taxed, and a month above R$ 20,000.00 of stocks taxes the stock gain.
func TestGainTaxExemptionReadsStocks(t *testing.T) {
	t.Parallel()

	got := New().GainTax([]domain.TaxSale{
		{Month: month(time.June), Kind: "swing", TaxClass: "stock", Gross: 2000001, Result: 10000},
		{Month: month(time.July), Kind: "swing", TaxClass: "etf", Gross: 100000, Result: 10000},
	})

	if len(got) != 2 || got[0].Lines[0].Exempt != 0 || got[0].Lines[0].Tax != 1500 ||
		got[1].Lines[0].Exempt != 0 || got[1].Lines[0].Tax != 1500 {
		t.Errorf("months = %+v, want both taxed at 15%%", got)
	}
}

// GT4: tax withheld beyond the tax of a month carries within the year only.
func TestGainTaxWithheldCarriesWithinTheYear(t *testing.T) {
	t.Parallel()

	nextJanuary := time.Date(2027, time.January, 1, 0, 0, 0, 0, time.UTC)
	got := New().GainTax([]domain.TaxSale{
		{
			Month:    month(time.November),
			Kind:     "day_trade",
			TaxClass: "stock",
			Gross:    100000,
			Result:   -1000,
			Withheld: 500,
		},
		{
			Month:    month(time.December),
			Kind:     "day_trade",
			TaxClass: "stock",
			Gross:    100000,
			Result:   1000,
			Withheld: 0,
		},
		{
			Month:    nextJanuary,
			Kind:     "day_trade",
			TaxClass: "stock",
			Gross:    100000,
			Result:   10000,
			Withheld: 0,
		},
	})

	// November keeps 5.00 withheld; December's tax of 0.00 (its gain spends the loss) leaves it;
	// January of the next year owes its 20.00 whole.
	if len(got) != 3 || got[2].Lines[0].Tax != 2000 || got[2].Lines[0].Due != 2000 {
		t.Errorf("months = %+v, want January 2027 to owe 20.00", got)
	}
}

// E-10: the sale of an ETF of fixed income stays out of the monthly tax: its tax is withheld at
// source.
func TestGainTaxLeavesFixedIncomeETF(t *testing.T) {
	t.Parallel()

	got := New().GainTax([]domain.TaxSale{
		{
			Month:    month(time.August),
			Kind:     "swing",
			TaxClass: "etf_fixed_income",
			Gross:    5000000,
			Result:   50000,
		},
	})

	if len(got) != 0 {
		t.Errorf("months = %+v, want none", got)
	}
}
