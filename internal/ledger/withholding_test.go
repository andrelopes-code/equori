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
