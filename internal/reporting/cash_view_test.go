package reporting_test

import (
	"maps"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// card is the Itaú Visa of section 6.21: closes on day 3, due on day 10.
type card struct {
	h                                                   *apitest.Harness
	card, checking, supermarket, electronics, discounts string
	laptop                                              purchase
}

type purchase struct {
	ID     string `json:"id"`
	PlanID string `json:"plan_id"`
}

// newCard records the supermarket purchase of S05 and the laptop of S06.
func newCard(t *testing.T) card {
	t.Helper()
	h := apitest.New(t, apitest.Today("2027-01-31"))
	food := h.Account("Food", "expense", "", nil)
	c := card{
		h: h, card: h.Card("Itaú Visa", 3, 10, "next"), checking: h.Account("Nubank", "asset", "checking", nil),
		supermarket: h.Account("Supermarket", "expense", "", map[string]any{"parent_id": food}),
		electronics: h.Account("Electronics", "expense", "", nil),
	}
	h.Record("2026-10-14", apitest.Posting(c.card, -23000), apitest.Posting(c.supermarket, 23000))
	var out struct {
		Transaction purchase `json:"transaction"`
		PlanID      string   `json:"plan_id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/installment-purchases", map[string]any{
		"card_account_id": c.card, "date": "2026-10-20",
		"splits":              []map[string]any{{"account_id": c.electronics, "amount": apitest.BRL(100000)}},
		"installment_count":   3,
		"installment_amounts": []map[string]any{apitest.BRL(33334), apitest.BRL(33333), apitest.BRL(33333)},
	}, http.StatusCreated, &out)
	c.laptop = purchase{ID: out.Transaction.ID, PlanID: out.PlanID}
	var accounts struct {
		Items []struct {
			ID         string `json:"id"`
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &accounts)
	for _, a := range accounts.Items {
		if a.SystemRole == "discounts" {
			c.discounts = a.ID
		}
	}
	return c
}

func (c card) pay(t *testing.T, statement, date string, amount int64) {
	t.Helper()
	var out struct {
		Items []struct {
			ID        string `json:"id"`
			Reference string `json:"reference"`
		} `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/statements?from=2026-01&to=2027-12", nil, http.StatusOK, &out)
	for _, s := range out.Items {
		if s.Reference == statement {
			c.h.MustDo(http.MethodPost, "/api/v1/statements/"+s.ID+"/payments", map[string]any{
				"date": date, "from_account_id": c.checking, "amount": apitest.BRL(amount),
			}, http.StatusCreated, nil)
			return
		}
	}
	t.Fatalf("no statement %s in %+v", statement, out.Items)
}

// totals reads the own total of every category with a non-zero total.
func totals(t *testing.T, h *apitest.Harness, class, view, from, to string) map[string]int64 {
	t.Helper()
	var out struct {
		Items []struct {
			AccountID string `json:"account_id"`
			Total     struct {
				Amount int64 `json:"amount"`
			} `json:"total"`
		} `json:"items"`
	}
	// The accrual view reads the balance series, which the outbox builds.
	h.Dispatch()
	path := "/api/v1/reports/categories?class=" + class + "&from=" + from + "&to=" + to
	if view != "" {
		path += "&view=" + view
	}
	h.MustDo(http.MethodGet, path, nil, http.StatusOK, &out)
	m := map[string]int64{}
	for _, it := range out.Items {
		if it.Total.Amount != 0 {
			m[it.AccountID] = it.Total.Amount
		}
	}
	return m
}

func expectTotals(t *testing.T, got, want map[string]int64) {
	t.Helper()
	if !maps.Equal(got, want) {
		t.Errorf("totals = %v, want %v", got, want)
	}
}

func TestS30(t *testing.T) {
	t.Parallel()
	t.Run("accrual", func(t *testing.T) {
		t.Parallel()
		c := newCard(t)
		c.pay(t, "2026-11", "2026-11-10", 56334)
		expectTotals(t, totals(t, c.h, "expense", "", "2026-10-01", "2026-10-31"), map[string]int64{c.supermarket: 23000, c.electronics: 100000})
		expectTotals(t, totals(t, c.h, "expense", "accrual", "2026-11-01", "2026-11-30"), map[string]int64{})
	})
	t.Run("cash, paid in full", func(t *testing.T) {
		t.Parallel()
		c := newCard(t)
		c.pay(t, "2026-11", "2026-11-10", 56334)
		expectTotals(t, totals(t, c.h, "expense", "cash", "2026-10-01", "2026-10-31"), map[string]int64{})
		expectTotals(t, totals(t, c.h, "expense", "cash", "2026-11-01", "2026-11-30"), map[string]int64{c.supermarket: 23000, c.electronics: 33334})
	})
	t.Run("cash, paid 50%", func(t *testing.T) {
		t.Parallel()
		c := newCard(t)
		c.pay(t, "2026-11", "2026-11-10", 28167)
		expectTotals(t, totals(t, c.h, "expense", "cash", "2026-11-01", "2026-11-30"), map[string]int64{c.supermarket: 11500, c.electronics: 16667})
	})
}

func TestS145(t *testing.T) {
	t.Parallel()
	c := newCard(t)
	c.pay(t, "2026-11", "2026-11-10", 20000)
	c.pay(t, "2026-11", "2026-12-05", 36334)
	expectTotals(t, totals(t, c.h, "expense", "cash", "2026-11-01", "2026-11-30"), map[string]int64{c.supermarket: 8165, c.electronics: 11835})
	expectTotals(t, totals(t, c.h, "expense", "cash", "2026-12-01", "2026-12-31"), map[string]int64{c.supermarket: 14835, c.electronics: 21499})
}

func TestS146(t *testing.T) {
	t.Parallel()
	c := newCard(t)
	var market struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/transactions?account_id="+c.supermarket, nil, http.StatusOK, &market)
	if len(market.Items) != 1 {
		t.Fatalf("supermarket transactions = %+v", market.Items)
	}
	c.h.MustDo(http.MethodPost, "/api/v1/transactions/"+market.Items[0].ID+"/refunds", map[string]any{"date": "2026-10-25", "amount": apitest.BRL(3000)}, http.StatusCreated, nil)
	c.pay(t, "2026-11", "2026-11-10", 53334)
	expectTotals(t, totals(t, c.h, "expense", "cash", "2026-11-01", "2026-11-30"), map[string]int64{c.supermarket: 20000, c.electronics: 33334})
	expectTotals(t, totals(t, c.h, "expense", "accrual", "2026-10-01", "2026-10-31"), map[string]int64{c.supermarket: 20000, c.electronics: 100000})
}

func TestS147(t *testing.T) {
	t.Parallel()
	c := newCard(t)
	c.h.MustDo(http.MethodPost, "/api/v1/installment-plans/"+c.laptop.PlanID+"/anticipation", map[string]any{
		"date": "2026-11-15", "from_installment": 2, "to_installment": 3, "target_statement": "2026-12", "amount": apitest.BRL(64000),
	}, http.StatusCreated, nil)
	c.pay(t, "2026-11", "2026-11-10", 56334)
	c.pay(t, "2026-12", "2026-12-10", 64000)
	expectTotals(t, totals(t, c.h, "expense", "cash", "2026-12-01", "2026-12-31"), map[string]int64{c.electronics: 66666})
	expectTotals(t, totals(t, c.h, "income", "cash", "2026-12-01", "2026-12-31"), map[string]int64{c.discounts: 2666})
	expectTotals(t, totals(t, c.h, "expense", "cash", "2027-01-01", "2027-01-31"), map[string]int64{})
}
