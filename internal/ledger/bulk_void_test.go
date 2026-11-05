package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type voidResult struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

// S291 (A202)
func TestS291BulkVoid(t *testing.T) {
	r := newReserveSetup(t)
	if got := assertBalance(r.h, r.reserve, "2026-10-31", 1000000).Status; got != http.StatusCreated {
		t.Fatalf("balance assertion status = %d, want 201", got)
	}

	fees := r.h.Account("Bank fees", "expense", "", nil)
	plain := r.h.Record("2026-10-05", apitest.Posting(r.checking, -500), apitest.Posting(fees, 500))
	done := r.h.Record("2026-10-06", apitest.Posting(r.checking, -700), apitest.Posting(fees, 700))
	r.h.MustDo(http.MethodPost, "/api/v1/transactions/"+done+"/void", map[string]string{"reason": "typo"}, http.StatusOK, nil)

	missing := "01a15600-0000-7000-8000-000000000000"

	got := bulkVoid(t, r.h, "duplicate", plain, done, r.transfer, missing)

	want := []voidResult{
		{plain, "voided"},
		{done, "transaction_voided"},
		{r.transfer, "posting_reconciled"},
		{missing, "not_found"},
	}
	if len(got) != len(want) {
		t.Fatalf("results = %+v, want %+v", got, want)
	}

	for i := range want {
		if got[i] != want[i] {
			t.Errorf("results[%d] = %+v, want %+v", i, got[i], want[i])
		}
	}

	if v := voidedAt(t, r.h, plain); v == "" {
		t.Error("voided_at of the voided transaction is empty")
	}
}

// S292 (A202)
func TestS292BulkVoidRepeatedTransaction(t *testing.T) {
	c := newCategoryTree(t)
	a := c.h.Record("2026-10-01", apitest.Posting(c.checking, -100), apitest.Posting(c.uncategorizedExpense, 100))

	post := func(ids ...string) apitest.Response {
		return c.h.Do(http.MethodPost, "/api/v1/transactions/void", voidBody("duplicate", ids...))
	}

	c.h.ExpectProblem(post(a, a), http.StatusUnprocessableEntity, "validation_failed", "items")
	c.h.ExpectProblem(post(), http.StatusBadRequest, "invalid_request", "items")

	if v := voidedAt(t, c.h, a); v != "" {
		t.Errorf("voided_at = %q, want empty", v)
	}
}

func bulkVoid(t *testing.T, h *apitest.Harness, reason string, ids ...string) []voidResult {
	t.Helper()
	var out struct {
		Results []voidResult `json:"results"`
	}
	h.MustDo(http.MethodPost, "/api/v1/transactions/void", voidBody(reason, ids...), http.StatusOK, &out)

	return out.Results
}

func voidBody(reason string, ids ...string) map[string]any {
	items := make([]map[string]string, len(ids))
	for i, id := range ids {
		items[i] = map[string]string{"id": id}
	}

	return map[string]any{"reason": reason, "items": items}
}

func voidedAt(t *testing.T, h *apitest.Harness, id string) string {
	t.Helper()
	var out struct {
		VoidedAt string `json:"voided_at"`
	}
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+id, nil, http.StatusOK, &out)

	return out.VoidedAt
}
