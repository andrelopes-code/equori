package reporting_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type categoryTotal struct {
	AccountID string `json:"account_id"`
	Total     struct {
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
	} `json:"total"`
	SubtreeTotal struct {
		Amount int64 `json:"amount"`
	} `json:"subtree_total"`
}

func categoryTotals(t *testing.T, h *apitest.Harness, query string) []categoryTotal {
	t.Helper()
	var out struct {
		Items []categoryTotal `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/reports/categories?"+query, nil, http.StatusOK, &out)
	return out.Items
}

// S76, Review Focus 1: totals of a month by category and by subtree (A77).
func TestS76CategoryTotals(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	delivery := h.Account("Delivery", "expense", "", map[string]any{"parent_id": food})
	groceries := h.Account("Groceries", "expense", "", map[string]any{"parent_id": food})
	travel := h.Account("Travel", "expense", "", nil)
	h.Record("2026-10-01", apitest.Posting(checking, -4500), apitest.Posting(delivery, 4500))
	h.Record("2026-10-20", apitest.Posting(checking, -1000), apitest.Posting(delivery, 1000))
	h.Record("2026-10-05", apitest.Posting(checking, -2000), apitest.Posting(groceries, 2000))
	h.Record("2026-10-14", apitest.Posting(checking, -2390), apitest.Posting(travel, 2390))
	h.Record("2026-11-01", apitest.Posting(checking, -999), apitest.Posting(travel, 999))
	h.Dispatch()

	items := categoryTotals(t, h, "from=2026-10-01&to=2026-10-31&class=expense")
	got := map[string][2]int64{}
	var order []string
	for _, it := range items {
		got[it.AccountID] = [2]int64{it.Total.Amount, it.SubtreeTotal.Amount}
		order = append(order, it.AccountID)
		if it.Total.Currency != "BRL" {
			t.Fatalf("currency of %s = %q", it.AccountID, it.Total.Currency)
		}
	}
	for id, want := range map[string][2]int64{food: {0, 7500}, delivery: {5500, 5500}, groceries: {2000, 2000}, travel: {2390, 2390}} {
		if got[id] != want {
			t.Errorf("account %s = %v, want %v", id, got[id], want)
		}
	}
	// Name order; the system expense categories of the user sit among them.
	pos := func(id string) int { return slices.Index(order, id) }
	if pos(delivery) > pos(food) || pos(food) > pos(groceries) || pos(groceries) > pos(travel) {
		t.Fatalf("order = %v", order)
	}
}

func TestCategoryTotalsIncomeIsPositive(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Checking", "asset", "checking", nil)
	salary := h.Account("Salary", "income", "", nil)
	h.Record("2026-10-05", apitest.Posting(checking, 300000), apitest.Posting(salary, -300000))
	h.Dispatch()
	for _, it := range categoryTotals(t, h, "from=2026-10-01&to=2026-10-31&class=income") {
		if it.AccountID == salary {
			if it.Total.Amount != 300000 || it.SubtreeTotal.Amount != 300000 {
				t.Fatalf("salary = %+v", it)
			}
			return
		}
	}
	t.Fatal("salary missing")
}

func TestCategoryTotalsRange(t *testing.T) {
	h := apitest.New(t)
	for _, q := range []string{"from=2026-10-31&to=2026-10-01&class=expense", "from=2026-01-01&to=2027-01-02&class=expense"} {
		h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/reports/categories?"+q, nil), http.StatusBadRequest, "invalid_request", "to")
	}
}

// ADR 003: another user's categories are not listed.
func TestCategoryTotalsOtherUser(t *testing.T) {
	h := apitest.New(t)
	other := h.Login("other@example.com")
	var foreign struct {
		ID string `json:"id"`
	}
	h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Food", "class": "expense", "currency": "BRL"}).Decode(t, &foreign)
	for _, it := range categoryTotals(t, h, "from=2026-10-01&to=2026-10-31&class=expense") {
		if it.AccountID == foreign.ID {
			t.Fatalf("another user's category listed: %+v", it)
		}
	}
}
