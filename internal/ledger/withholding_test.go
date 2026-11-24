package ledger_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

func TestDefaultWithholdingBP(t *testing.T) {
	t.Parallel()

	// FS-S1 and FS-S2: the JCP rate is 15% up to 2025-12-31 and 17.5% from 2026-01-01 (A235).
	tests := []struct {
		region, incomeType, date string
		want                     int
	}{
		{"BR", "jcp", "2025-12-31", 1500},
		{"BR", "jcp", "2026-01-01", 1750},
		{"BR", "jcp", "2026-10-22", 1750},
		{"BR", "dividend", "2026-10-22", 0},
		{"PT", "jcp", "2026-10-22", 0},
		{"", "jcp", "2026-10-22", 0},
	}
	for _, tc := range tests {
		date, err := time.Parse(time.DateOnly, tc.date)
		if err != nil {
			t.Fatal(err)
		}

		if got := ledger.DefaultWithholdingBP(tc.region, tc.incomeType, date); got != tc.want {
			t.Errorf(
				"DefaultWithholdingBP(%q, %q, %s) = %d, want %d",
				tc.region,
				tc.incomeType,
				tc.date,
				got,
				tc.want,
			)
		}
	}
}

func TestJCPIncomeOutsideBRHasNoDefaultWithholding(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-22"))
	pt := h.LoginAs("pt@example.com", locale.Locale{Language: "pt", Region: "PT"}, "EUR")
	create := func(path string, body map[string]any, out any) {
		t.Helper()

		r := h.Call(pt, http.MethodPost, path, body)
		if r.Status != http.StatusCreated {
			t.Fatalf("POST %s status = %d: %s", path, r.Status, r.Body)
		}

		if out != nil {
			r.Decode(t, out)
		}
	}
	type idOut struct {
		ID string `json:"id"`
	}
	inst := security("ALPHA", "stock")
	inst["quote_currency"] = "EUR"
	create("/api/v1/instruments", inst, nil)
	var broker idOut
	create("/api/v1/institutions", map[string]any{"name": "Broker"}, &broker)

	account := func(name, kind, currency string, extra map[string]any) string {
		t.Helper()

		body := map[string]any{"name": name, "class": "asset", "kind": kind, "currency": currency}
		for k, v := range extra {
			body[k] = v
		}

		var out idOut
		create("/api/v1/accounts", body, &out)

		return out.ID
	}
	parent := account("Broker", "brokerage", "EUR", map[string]any{"institution_id": broker.ID})
	child := map[string]any{"institution_id": broker.ID, "parent_id": parent}
	cash := account("Broker cash", "brokerage", "EUR", child)
	alpha := account("Broker ALPHA", "brokerage", "ALPHA", child)
	var income idOut
	create(
		"/api/v1/accounts",
		map[string]any{"name": "Income", "class": "income", "currency": "EUR"},
		&income,
	)

	var tx incomeTx
	create("/api/v1/investment-income", map[string]any{
		"account_id": alpha, "cash_account_id": cash, "income_type": "jcp", "date": "2026-10-22",
		"gross": map[string]any{"amount": 4500, "currency": "EUR"}, "category_id": income.ID,
	}, &tx)

	if tx.Income == nil || tx.Income.Withheld["amount"] != float64(0) {
		t.Fatalf("income detail = %+v", tx.Income)
	}

	if len(tx.Postings) != 2 || tx.Postings[0].Amount["amount"] != float64(4500) {
		t.Fatalf("postings = %+v", tx.Postings)
	}
}

// S699: the estimate of the tax withheld on an income is the amount a record without withheld
// takes, and nothing is recorded.
func TestS699IncomeWithholdingEstimate(t *testing.T) {
	t.Parallel()
	f := newIncomeFixture(t)

	tests := []struct {
		query        string
		rate, amount int64
	}{
		{"income_type=jcp&date=2026-10-26&gross=4500", 1750, 788},
		{"income_type=jcp&date=2025-12-31&gross=4500", 1500, 675},
		{"income_type=dividend&date=2026-10-26&gross=4500", 0, 0},
	}
	for _, tc := range tests {
		got := incomeEstimate(t, f.h, tc.query)
		if got.RateBP != tc.rate || got.Withheld != minorUnits(tc.amount, "BRL") {
			t.Errorf("%s = %+v, want rate %d and %d BRL", tc.query, got, tc.rate, tc.amount)
		}
	}

	for _, query := range []string{
		"income_type=JCP&date=2026-10-26&gross=4500",
		"income_type=jcp&date=2026-10-26&gross=0",
	} {
		r := f.h.Do(http.MethodGet, "/api/v1/investment-income/withholding?"+query, nil)
		if r.Status != http.StatusBadRequest {
			t.Errorf("%s status = %d, want 400: %s", query, r.Status, r.Body)
		}
	}
}

// X2: a region without a rate estimates nothing, in the base currency of its book.
func TestIncomeWithholdingEstimateOutsideBR(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-22"))
	pt := h.LoginAs("pt@example.com", locale.Locale{Language: "pt", Region: "PT"}, "EUR")

	r := h.Call(
		pt,
		http.MethodGet,
		"/api/v1/investment-income/withholding?income_type=jcp&date=2026-10-22&gross=4500",
		nil,
	)
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	var got incomeEstimateOut
	r.Decode(t, &got)

	if got.RateBP != 0 || got.Withheld != minorUnits(0, "EUR") {
		t.Fatalf("estimate = %+v", got)
	}
}

type estimateMoney struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}

type incomeEstimateOut struct {
	RateBP   int64         `json:"rate_bp"`
	Withheld estimateMoney `json:"withheld"`
}

func incomeEstimate(t *testing.T, h *apitest.Harness, query string) incomeEstimateOut {
	t.Helper()

	var out incomeEstimateOut
	h.MustDo(
		http.MethodGet,
		"/api/v1/investment-income/withholding?"+query,
		nil,
		http.StatusOK,
		&out,
	)

	return out
}

func minorUnits(amount int64, currency string) estimateMoney {
	return estimateMoney{Amount: amount, Currency: currency}
}
