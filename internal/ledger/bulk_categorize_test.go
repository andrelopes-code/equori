package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type bulkResult struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Version int    `json:"version"`
}

func bulkCategorize(t *testing.T, h *apitest.Harness, category string, items ...map[string]any) []bulkResult {
	t.Helper()
	var out struct {
		Results []bulkResult `json:"results"`
	}
	h.MustDo(http.MethodPost, "/api/v1/transactions/categorize", map[string]any{"category_id": category, "items": items}, http.StatusOK, &out)
	return out.Results
}

func item(id string, version int) map[string]any {
	return map[string]any{"id": id, "expected_version": version}
}

// S77: several transactions take one category; a stale version is reported, not applied (A78).
func TestS77BulkCategorize(t *testing.T) {
	t.Parallel()
	c := newCategoryTree(t)
	a := c.h.Record("2026-10-01", apitest.Posting(c.checking, -100), apitest.Posting(c.uncategorizedExpense, 100))
	b := c.h.Record("2026-10-02", apitest.Posting(c.checking, -200), apitest.Posting(c.uncategorizedExpense, 120), apitest.Posting(c.delivery, 80))
	stale := c.h.Record("2026-10-03", apitest.Posting(c.checking, -300), apitest.Posting(c.uncategorizedExpense, 300))

	got := bulkCategorize(t, c.h, c.bakery, item(a, 1), item(b, 1), item(stale, 7))
	want := []bulkResult{{a, "categorized", 2}, {b, "categorized", 2}, {stale, "version_conflict", 0}}
	if len(got) != len(want) {
		t.Fatalf("results = %+v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("result %d = %+v, want %+v", i, got[i], want[i])
		}
	}
	if amounts := amountsByAccount(c.h.Transaction(b)); amounts[c.bakery] != 200 || amounts[c.delivery] != 0 || amounts[c.uncategorizedExpense] != 0 {
		t.Fatalf("b postings = %v", amounts)
	}
	if v := c.h.Transaction(stale); v.Version != 1 {
		t.Fatalf("stale version = %d", v.Version)
	}
}

func TestBulkCategorizeItemStatuses(t *testing.T) {
	t.Parallel()
	c := newCategoryTree(t)
	voided := c.h.Record("2026-10-01", apitest.Posting(c.checking, -100), apitest.Posting(c.uncategorizedExpense, 100))
	c.h.MustDo(http.MethodPost, "/api/v1/transactions/"+voided+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)
	savings := c.h.Account("Savings", "asset", "savings", nil)
	transfer := c.h.Record("2026-10-02", apitest.Posting(c.checking, -100), apitest.Posting(savings, 100))
	missing := "01a15600-0000-7000-8000-000000000000"

	got := bulkCategorize(t, c.h, c.bakery, item(voided, 1), item(transfer, 1), item(missing, 1))
	for i, want := range []string{"transaction_voided", "not_categorizable", "not_found"} {
		if got[i].Status != want {
			t.Fatalf("result %d = %+v, want %s", i, got[i], want)
		}
	}
}

// Review Focus 2 and the category checks: the request is rejected before any item runs.
func TestBulkCategorizeRejections(t *testing.T) {
	t.Parallel()
	c := newCategoryTree(t)
	a := c.h.Record("2026-10-01", apitest.Posting(c.checking, -100), apitest.Posting(c.uncategorizedExpense, 100))
	closed := c.h.Account("Closed", "expense", "", nil)
	c.h.MustDo(http.MethodPost, "/api/v1/accounts/"+closed+"/close", map[string]string{"closed_on": "2026-09-30"}, http.StatusOK, nil)
	post := func(category string, items ...map[string]any) apitest.Response {
		return c.h.Do(http.MethodPost, "/api/v1/transactions/categorize", map[string]any{"category_id": category, "items": items})
	}
	c.h.ExpectProblem(post(c.bakery, item(a, 1), item(a, 1)), http.StatusUnprocessableEntity, "validation_failed", "items")
	c.h.ExpectProblem(post(closed, item(a, 1)), http.StatusUnprocessableEntity, "validation_failed", "category_id")
	c.h.ExpectProblem(post(c.checking, item(a, 1)), http.StatusUnprocessableEntity, "validation_failed", "category_id")
	if v := c.h.Transaction(a); v.Version != 1 {
		t.Fatalf("version after rejections = %d", v.Version)
	}
}
