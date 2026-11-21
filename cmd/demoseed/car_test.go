package main

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
	platformmoney "github.com/andrelopes-code/equori/internal/platform/money"
)

// assertCarAndDollar checks the goods and the debt of the persona on the last day of the history: the car at its
// latest FIPE value, the financing at the principal its paid installments leave, and the dollars valued in reais.
func assertCarAndDollar(t *testing.T, s *seeder) {
	t.Helper()

	var worth struct {
		Accounts []struct {
			AccountID string `json:"account_id"`
			Value     money  `json:"value"`
		} `json:"accounts"`
	}
	s.do(http.MethodGet, "/reports/net-worth?date="+testToday, nil, &worth)

	if s.err != nil {
		t.Fatal(s.err)
	}

	value := map[string]money{}
	for _, a := range worth.Accounts {
		value[a.AccountID] = a.Value
	}

	paid := 0
	for _, tx := range s.transactions(t) {
		if strings.HasPrefix(tx.Description, "Parcela ") &&
			strings.Contains(tx.Description, "HB20") {
			paid++
		}
	}

	if paid != 14 {
		t.Errorf("installments paid by %s = %d, want 14 (2025-09 to 2026-10)", testToday, paid)
	}

	if got, want := value[s.id("car.loan")], brl(-loanPrincipalAfter(paid)); got != want {
		t.Errorf("financing on %s = %+v, want %+v", testToday, got, want)
	}

	if got, want := value[s.id("car")], brl(carValueOn(day(testToday))); got != want {
		t.Errorf("car on %s = %+v, want %+v", testToday, got, want)
	}

	usd := s.balanceOn("nomad.usd", testToday)
	if got := value[s.id("nomad.usd")]; got.Currency != "BRL" || got.Amount < usd*5 || usd <= 0 {
		t.Errorf(
			"dollars on %s = %d cents of USD valued %+v, want over 5 reais each",
			testToday,
			usd,
			got,
		)
	}
}

func TestLoanScheduleRepaysThePrincipal(t *testing.T) {
	rows := loanSchedule()

	var principal int64
	for _, r := range rows {
		principal += r.principal

		if r.principal+r.interest != carInstallment && r.n != carInstallments {
			t.Errorf(
				"installment %d = %d + %d, want %d",
				r.n,
				r.principal,
				r.interest,
				carInstallment,
			)
		}
	}

	if len(rows) != carInstallments || principal != carFinanced {
		t.Errorf("schedule = %d installments of principal %d, want %d of %d",
			len(rows), principal, carInstallments, carFinanced)
	}

	if rows[0].interest != 52688 {
		t.Errorf("first interest = %d, want 52688 (1.89 %% of R$ 27.877,46)", rows[0].interest)
	}
}

// storeDollarRates gives the instance the PTAX the feed bcb_ptax would hold: the rate of usdRates on the last day of
// every month of the history.
func storeDollarRates(t *testing.T, h *apitest.Harness, today time.Time) {
	t.Helper()

	var prices []marketdata.Price

	for _, m := range months(firstOfMonth(today).AddDate(0, -historyMonths, 0), today) {
		r, err := platformmoney.ParseRate(
			rate(float64(step(m, usdRates["2024-11"], usdRates)) / 10000),
		)
		if err != nil {
			t.Fatal(err)
		}

		end := m.AddDate(0, 1, -1)
		if end.After(today) {
			end = today
		}

		prices = append(prices, marketdata.Price{
			Instrument: "USD",
			Quote:      "BRL",
			Date:       end,
			Value:      r,
			Source:     "bcb_ptax",
		})
	}

	if err := h.App.Marketdata.RecordPrices(t.Context(), 0, prices); err != nil {
		t.Fatal(err)
	}
}
