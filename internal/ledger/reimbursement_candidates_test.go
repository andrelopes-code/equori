package ledger_test

import (
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type candidateList struct {
	Items []struct {
		Transaction struct {
			ID string `json:"id"`
		} `json:"transaction"`
		Remaining struct {
			Amount   int64  `json:"amount"`
			Currency string `json:"currency"`
		} `json:"remaining"`
		Allocated struct {
			Amount int64 `json:"amount"`
		} `json:"allocated"`
	} `json:"items"`
	Suggestion []string `json:"suggestion"`
}

func (b reimbursementBooks) candidates(t *testing.T, id string) candidateList {
	t.Helper()
	var out candidateList
	b.h.MustDo(http.MethodGet, "/api/v1/transactions/"+id+"/reimbursement-candidates", nil, http.StatusOK, &out)
	return out
}

func (c candidateList) ids() []string {
	out := make([]string, len(c.Items))
	for i, item := range c.Items {
		out[i] = item.Transaction.ID
	}
	return out
}

// S114: the expense of the same remaining amount comes first, then the newest (A117).
func TestReimbursementCandidatesRanking_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	older := b.expense("2026-10-10", 1500)
	other := b.expense("2026-10-18", 2000)
	newest := b.expense("2026-10-19", 4000)
	inflow := b.inflow("2026-10-20", 1500)

	got := b.candidates(t, inflow)

	if want := []string{older, newest, other}; !slices.Equal(got.ids(), want) {
		t.Fatalf("candidates = %v, want %v", got.ids(), want)
	}
	if got.Items[0].Remaining.Amount != 1500 || got.Items[0].Remaining.Currency != "BRL" || got.Items[0].Allocated.Amount != 0 {
		t.Fatalf("first = %+v, want remaining 1500 BRL and nothing allocated", got.Items[0])
	}
}

// S114: what other transactions hold is out of the remaining amount (A117).
func TestReimbursementCandidatesRemaining_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	partial := b.expense("2026-10-17", 1500)
	whole := b.expense("2026-10-18", 500)
	repaid := b.inflow("2026-10-19", 1000)
	mustReimburse(t, b.h, repaid, 1, alloc(partial, 1000))
	inflow := b.inflow("2026-10-20", 500)

	got := b.candidates(t, inflow)

	if want := []string{whole, partial}; !slices.Equal(got.ids(), want) {
		t.Fatalf("candidates = %v, want %v", got.ids(), want)
	}
	if got.Items[1].Remaining.Amount != 500 {
		t.Fatalf("remaining of the partly reimbursed expense = %d, want 500", got.Items[1].Remaining.Amount)
	}
}

// S114: transactions that cannot be reimbursed are not offered (A117).
func TestReimbursementCandidatesExclusions_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	eligible := b.expense("2026-10-17", 1500)
	edge := b.expense("2026-07-22", 1500)
	b.expense("2026-07-21", 1500)
	b.expense("2026-10-21", 1500)
	voided := b.expense("2026-10-17", 1500)
	b.h.MustDo(http.MethodPost, "/api/v1/transactions/"+voided+"/void", map[string]string{"reason": "x"}, http.StatusOK, nil)
	repaid := b.expense("2026-10-16", 1500)
	full := b.inflow("2026-10-18", 1500)
	mustReimburse(t, b.h, full, 1, alloc(repaid, 1500))
	salary := b.h.Account("Salary", "income", "", nil)
	b.h.Record("2026-10-05", apitest.Posting(b.nubank, 1500), apitest.Posting(salary, -1500))
	inflow := b.inflow("2026-10-20", 1500)

	got := b.candidates(t, inflow)

	if want := []string{eligible, edge}; !slices.Equal(got.ids(), want) {
		t.Fatalf("candidates = %v, want %v", got.ids(), want)
	}
}

// S114: the suggestion is the only combination that adds up to the amount received (A117).
func TestReimbursementCandidatesSuggestion_S114(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		expenses []int64
		inflow   int64
		want     []int
	}{
		{"two expenses add up", []int64{5000, 5000, 3000}, 10000, []int{0, 1}},
		{"one expense matches", []int64{1500, 4000}, 1500, []int{0}},
		{"several combinations", []int64{5000, 5000, 10000}, 10000, nil},
		{"no combination", []int64{4000, 6000}, 5000, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			b := newReimbursementBooks(t)
			var ids []string
			for i, amount := range tt.expenses {
				ids = append(ids, b.expense("2026-10-1"+string(rune('0'+i)), amount))
			}
			inflow := b.inflow("2026-10-20", tt.inflow)

			got := b.candidates(t, inflow)

			var want []string
			for _, i := range tt.want {
				want = append(want, ids[i])
			}
			slices.Sort(want)
			slices.Sort(got.Suggestion)
			if !slices.Equal(got.Suggestion, want) {
				t.Fatalf("suggestion = %v, want %v", got.Suggestion, want)
			}
		})
	}
}

// S114: a transaction that already repays expenses lists them as allocated and suggests nothing (A117).
func TestReimbursementCandidatesAllocated_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	old := b.expense("2026-05-01", 1000)
	recent := b.expense("2026-10-17", 1500)
	inflow := b.inflow("2026-10-20", 1000)
	mustReimburse(t, b.h, inflow, 1, alloc(old, 1000))

	got := b.candidates(t, inflow)

	if want := []string{old, recent}; !slices.Equal(got.ids(), want) {
		t.Fatalf("candidates = %v, want %v", got.ids(), want)
	}
	if got.Items[0].Allocated.Amount != 1000 || got.Items[0].Remaining.Amount != 1000 || got.Items[1].Allocated.Amount != 0 {
		t.Fatalf("items = %+v", got.Items)
	}
	if got.Suggestion != nil {
		t.Fatalf("suggestion = %v, want none", got.Suggestion)
	}
}

// S114: an outflow has nothing to reimburse and the list is an empty array (A117).
func TestReimbursementCandidatesOfOutflow_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	b.expense("2026-10-17", 1500)
	outflow := b.expense("2026-10-20", 1500)

	r := b.h.Do(http.MethodGet, "/api/v1/transactions/"+outflow+"/reimbursement-candidates", nil)

	if r.Status != http.StatusOK || !strings.Contains(string(r.Body), `"items":[]`) {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
}

func TestReimbursementCandidatesUnknownTransaction_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	b.h.ExpectProblem(b.h.Do(http.MethodGet, "/api/v1/transactions/00000000-0000-7000-8000-000000000000/reimbursement-candidates", nil), http.StatusNotFound, "not_found", "")
}
