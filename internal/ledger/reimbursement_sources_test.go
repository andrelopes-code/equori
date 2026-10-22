package ledger_test

import (
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type sourceList struct {
	Items []struct {
		Transaction struct {
			ID string `json:"id"`
		} `json:"transaction"`
		Free struct {
			Amount   int64  `json:"amount"`
			Currency string `json:"currency"`
		} `json:"free"`
	} `json:"items"`
}

func (b reimbursementBooks) sources(t *testing.T, id string) sourceList {
	t.Helper()
	var out sourceList
	b.h.MustDo(http.MethodGet, "/api/v1/transactions/"+id+"/reimbursement-sources", nil, http.StatusOK, &out)
	return out
}

func (s sourceList) ids() []string {
	out := make([]string, len(s.Items))
	for i, item := range s.Items {
		out[i] = item.Transaction.ID
	}
	return out
}

// S114: the inflows that can repay an expense, with what is left of each (A117).
func TestReimbursementSources_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-10", 10000)
	other := b.expense("2026-10-11", 10000)
	soonest := b.inflow("2026-10-10", 3000)
	partly := b.inflow("2026-10-12", 5000)
	mustReimburse(t, b.h, partly, 1, alloc(other, 2000))
	b.inflow("2026-10-09", 3000)
	b.inflow("2026-01-31", 3000)
	linked := b.inflow("2026-10-13", 3000)
	mustReimburse(t, b.h, linked, 1, alloc(expense, 3000))
	voided := b.inflow("2026-10-14", 3000)
	b.h.MustDo(http.MethodPost, "/api/v1/transactions/"+voided+"/void", map[string]string{"reason": "x"}, http.StatusOK, nil)
	salary := b.h.Account("Salary", "income", "", nil)
	b.h.Record("2026-10-15", apitest.Posting(b.nubank, 3000), apitest.Posting(salary, -3000))
	full := b.inflow("2026-10-16", 4000)
	mustReimburse(t, b.h, full, 1, alloc(other, 4000))

	got := b.sources(t, expense)

	if want := []string{soonest, partly}; !slices.Equal(got.ids(), want) {
		t.Fatalf("sources = %v, want %v", got.ids(), want)
	}
	if got.Items[0].Free.Amount != 3000 || got.Items[0].Free.Currency != "BRL" || got.Items[1].Free.Amount != 3000 {
		t.Fatalf("free = %+v, want 3000 and 3000", got.Items)
	}
}

// S114: an inflow or a transfer has no expense to repay and the list is an empty array (A117).
func TestReimbursementSourcesOfInflow_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	inflow := b.inflow("2026-10-20", 1500)

	r := b.h.Do(http.MethodGet, "/api/v1/transactions/"+inflow+"/reimbursement-sources", nil)

	if r.Status != http.StatusOK || !strings.Contains(string(r.Body), `"items":[]`) {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
}

func TestReimbursementSourcesUnknownTransaction_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	b.h.ExpectProblem(b.h.Do(http.MethodGet, "/api/v1/transactions/00000000-0000-7000-8000-000000000000/reimbursement-sources", nil), http.StatusNotFound, "not_found", "")
}
