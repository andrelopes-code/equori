package portfolio_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S674, A262 TR1 and TR2: the results of the sales and the income of each account up to the date,
// and their sums over every account, the closed PETR4 included.
func TestS674TotalResult(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.trade(t, "buy", "2026-10-05", 150, "10.05", 490)
	f.trade(t, "sell", "2026-10-20", 50, "10.80", 210)
	f.petr4Trade(t, "buy", "2026-10-05", 10, "10.00")
	f.petr4Trade(t, "sell", "2026-10-15", 10, "12.00")
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/prices",
		map[string]any{
			"instrument":       "MXRF11",
			"quote_instrument": "BRL",
			"date":             "2026-10-29",
			"value":            "9.36",
		},
		http.StatusCreated,
		nil,
	)

	income := func(account, typ string, gross int64, category string) {
		f.h.MustDo(http.MethodPost, "/api/v1/investment-income", map[string]any{
			"account_id":      account,
			"cash_account_id": f.cash,
			"income_type":     typ,
			"date":            "2026-10-26",
			"gross":           apitest.BRL(gross),
			"category_id":     category,
		}, http.StatusCreated, nil)
	}
	income(f.mxrf11, "dividend", 1000, f.dividends)
	income(f.petr4, "jcp", 4500, f.jcp)

	cases := []struct {
		date             string
		income           int64
		realizedTotal    int64
		incomeTotalCount int
		incomeTotal      int64
	}{
		{"2026-11-01", 1000, 5377, 1, 4712},
		{"2026-10-26", 1000, 5377, 1, 4712},
		{"2026-10-25", 0, 5377, 0, 0},
	}
	for _, c := range cases {
		out := totalResults(t, f, c.date)

		if len(out.Items) != 1 {
			t.Fatalf("%s: items = %+v", c.date, out.Items)
		}

		p := out.Items[0]
		if p.AccountID != f.mxrf11 || p.Realized == nil ||
			p.Realized.Amount != 3377 || p.Realized.Currency != "BRL" {
			t.Fatalf("%s: realized = %+v", c.date, p.Realized)
		}

		switch {
		case c.income == 0 && p.Income != nil:
			t.Fatalf("%s: income = %+v, want none", c.date, p.Income)
		case c.income != 0 && (p.Income == nil || p.Income.Amount != c.income ||
			p.Income.Currency != "BRL"):
			t.Fatalf("%s: income = %+v, want %d BRL", c.date, p.Income, c.income)
		}

		if len(out.Realized) != 1 || out.Realized[0].Amount != c.realizedTotal ||
			out.Realized[0].Currency != "BRL" {
			t.Fatalf("%s: realized totals = %+v", c.date, out.Realized)
		}

		if len(out.Income) != c.incomeTotalCount ||
			c.incomeTotalCount == 1 && (out.Income[0].Amount != c.incomeTotal ||
				out.Income[0].Currency != "BRL") {
			t.Fatalf("%s: income totals = %+v", c.date, out.Income)
		}
	}
}

type totalResultOut struct {
	Items []struct {
		AccountID string    `json:"account_id"`
		Realized  *moneyOut `json:"realized"`
		Income    *moneyOut `json:"income"`
	} `json:"items"`
	Realized []moneyOut `json:"realized"`
	Income   []moneyOut `json:"income"`
}

func totalResults(t *testing.T, f fixture, date string) totalResultOut {
	t.Helper()
	f.h.Dispatch()

	var out totalResultOut
	f.h.MustDo(http.MethodGet, "/api/v1/positions?date="+date, nil, http.StatusOK, &out)

	return out
}
