package portfolio_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S283: net worth at the end of each day of a range (net worth days design, D1).
func TestS283NetWorthDays(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	checking := f.h.Account("Nubank", "asset", "checking", nil)
	loan := f.h.Account("Loan", "liability", "loan", nil)
	food := f.h.Account("Food", "expense", "", nil)
	f.h.Record("2026-10-01", apitest.Posting(checking, 100000), apitest.Posting(f.dividends, -100000))
	f.h.Record("2026-10-20", apitest.Posting(food, 30000), apitest.Posting(loan, -30000))
	f.h.Dispatch()

	var out struct {
		Items []struct {
			Date        string         `json:"date"`
			Assets      map[string]any `json:"assets"`
			Liabilities map[string]any `json:"liabilities"`
			Net         map[string]any `json:"net"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/reports/net-worth/days?from=2026-10-19&to=2026-10-21", nil, http.StatusOK, &out)

	want := []struct {
		date             string
		liabilities, net float64
	}{{"2026-10-19", 0, 100000}, {"2026-10-20", 30000, 70000}, {"2026-10-21", 30000, 70000}}
	if len(out.Items) != len(want) {
		t.Fatalf("items = %+v", out.Items)
	}

	for i, w := range want {
		got := out.Items[i]
		if got.Date != w.date || got.Assets["amount"] != float64(100000) || got.Liabilities["amount"] != w.liabilities ||
			got.Net["amount"] != w.net || got.Net["currency"] != "BRL" {
			t.Fatalf("day %d = %+v, want %+v", i, got, w)
		}
	}
}

// S284: a reversed range and a range of more than 62 days are rejected (D2).
func TestS284NetWorthDaysRange(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	for _, query := range []string{"from=2026-10-21&to=2026-10-19", "from=2026-08-01&to=2026-10-19"} {
		f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/reports/net-worth/days?"+query, nil), http.StatusBadRequest, "invalid_request", "to")
	}
}
