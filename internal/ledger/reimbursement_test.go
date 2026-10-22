package ledger_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type reimbursementBooks struct {
	h        *apitest.Harness
	sys      map[string]string
	mercado  string
	nubank   string
	car      string
	maintain string
}

func newReimbursementBooks(t *testing.T) reimbursementBooks {
	t.Helper()
	h := apitest.New(t, apitest.Today("2026-10-21"))
	return reimbursementBooks{
		h:        h,
		sys:      systemAccounts(h),
		mercado:  h.Account("Mercado Pago", "asset", "checking", nil),
		nubank:   h.Account("Nubank", "asset", "checking", nil),
		car:      h.Account("Car", "expense", "", nil),
		maintain: h.Account("Maintenance", "expense", "", nil),
	}
}

func (b reimbursementBooks) expense(date string, amount int64) string {
	return b.h.Record(date, apitest.Posting(b.mercado, -amount), apitest.Posting(b.car, amount))
}

func (b reimbursementBooks) inflow(date string, amount int64) string {
	return b.h.Record(date, apitest.Posting(b.nubank, amount), apitest.Posting(b.sys["uncategorized_income"], -amount))
}

func alloc(original string, amount int64) map[string]any {
	return map[string]any{"original_id": original, "amount": apitest.BRL(amount)}
}

func allocIn(original string, amount int64, category string) map[string]any {
	a := alloc(original, amount)
	a["category_id"] = category
	return a
}

func reimburse(h *apitest.Harness, id string, version int, allocations ...map[string]any) apitest.Response {
	if allocations == nil {
		allocations = []map[string]any{}
	}
	return h.Do(http.MethodPost, "/api/v1/transactions/"+id+"/reimbursement", map[string]any{"expected_version": version, "allocations": allocations})
}

type reimbursedView struct {
	Version int `json:"version"`
	Links   []struct {
		Type   string `json:"type"`
		Target string `json:"target"`
		Amount *struct {
			Amount int64 `json:"amount"`
		} `json:"amount"`
	} `json:"links"`
	Postings []struct {
		AccountID string `json:"account_id"`
		Amount    struct {
			Amount int64 `json:"amount"`
		} `json:"amount"`
	} `json:"postings"`
	ReferencedBy []struct {
		Type   string `json:"type"`
		Source string `json:"source"`
	} `json:"referenced_by"`
}

func (v reimbursedView) amountOn(account string) int64 {
	var sum int64
	for _, p := range v.Postings {
		if p.AccountID == account {
			sum += p.Amount.Amount
		}
	}
	return sum
}

func getReimbursed(t *testing.T, h *apitest.Harness, id string) reimbursedView {
	t.Helper()
	var out reimbursedView
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+id, nil, http.StatusOK, &out)
	return out
}

func octoberExpense(t *testing.T, h *apitest.Harness, account string) int64 {
	t.Helper()
	h.Dispatch()
	var out struct {
		Items []struct {
			AccountID string `json:"account_id"`
			Total     struct {
				Amount int64 `json:"amount"`
			} `json:"total"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/reports/categories?from=2026-10-01&to=2026-10-31&class=expense", nil, http.StatusOK, &out)
	for _, item := range out.Items {
		if item.AccountID == account {
			return item.Total.Amount
		}
	}
	t.Fatalf("category %s absent from the report", account)
	return 0
}

func (v reimbursedView) held(target string) int64 {
	for _, l := range v.Links {
		if l.Type == "reimbursement_of" && l.Target == target && l.Amount != nil {
			return l.Amount.Amount
		}
	}
	return 0
}

func mustReimburse(t *testing.T, h *apitest.Harness, id string, version int, allocations ...map[string]any) {
	t.Helper()
	if r := reimburse(h, id, version, allocations...); r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
}

// S113: an incoming transaction that repays a recorded expense nets it (A117).
func TestReimbursementNetsExpense_S113(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-17", 1500)
	inflow := b.inflow("2026-10-20", 1500)
	if got := octoberExpense(t, b.h, b.car); got != 1500 {
		t.Fatalf("Car before = %d, want 1500", got)
	}

	mustReimburse(t, b.h, inflow, 1, alloc(expense, 1500))

	got := getReimbursed(t, b.h, inflow)
	if got.Version != 2 || got.amountOn(b.nubank) != 1500 || got.amountOn(b.car) != -1500 || got.amountOn(b.sys["uncategorized_income"]) != 0 {
		t.Fatalf("reimbursement = %+v", got)
	}
	if len(got.Links) != 1 || got.Links[0].Type != "reimbursement_of" || got.Links[0].Target != expense || got.held(expense) != 1500 {
		t.Fatalf("links = %+v, want reimbursement_of %s holding 1500", got.Links, expense)
	}
	original := getReimbursed(t, b.h, expense)
	if len(original.ReferencedBy) != 1 || original.ReferencedBy[0].Type != "reimbursement_of" || original.ReferencedBy[0].Source != inflow {
		t.Fatalf("referenced_by = %+v, want reimbursement_of %s", original.ReferencedBy, inflow)
	}
	if got := octoberExpense(t, b.h, b.car); got != 0 {
		t.Fatalf("Car after = %d, want 0", got)
	}
}

// S114: 100.00 received for two expenses of 50.00 (A117).
func TestReimbursementTwoExpensesOneInflow_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	first, second := b.expense("2026-10-15", 5000), b.expense("2026-10-16", 5000)
	inflow := b.inflow("2026-10-20", 10000)

	mustReimburse(t, b.h, inflow, 1, alloc(first, 5000), alloc(second, 5000))

	got := getReimbursed(t, b.h, inflow)
	if got.amountOn(b.nubank) != 10000 || got.amountOn(b.car) != -10000 || got.amountOn(b.sys["uncategorized_income"]) != 0 {
		t.Fatalf("inflow = %+v", got)
	}
	if len(got.Links) != 2 || got.held(first) != 5000 || got.held(second) != 5000 {
		t.Fatalf("links = %+v, want 5000 on each expense", got.Links)
	}
	if got := octoberExpense(t, b.h, b.car); got != 0 {
		t.Fatalf("Car after = %d, want 0", got)
	}
}

// S114: 100.00 received twice for one expense of 200.00 (A117).
func TestReimbursementHalfOfAnExpense_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-10", 20000)
	first, second, third := b.inflow("2026-10-15", 10000), b.inflow("2026-10-16", 10000), b.inflow("2026-10-17", 100)

	mustReimburse(t, b.h, first, 1, alloc(expense, 10000))
	if got := octoberExpense(t, b.h, b.car); got != 10000 {
		t.Fatalf("Car after the first = %d, want 10000", got)
	}
	mustReimburse(t, b.h, second, 1, alloc(expense, 10000))
	if got := octoberExpense(t, b.h, b.car); got != 0 {
		t.Fatalf("Car after the second = %d, want 0", got)
	}

	r := reimburse(b.h, third, 1, alloc(expense, 100))
	b.h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "allocations[0].original_id")
	if !strings.Contains(string(r.Body), "20100") || !strings.Contains(string(r.Body), "20000") {
		t.Fatalf("detail does not name both totals: %s", r.Body)
	}
}

// S114: what exceeds the expense stays income to categorize (A117).
func TestReimbursementLeftoverStaysUncategorized_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-17", 10000)
	inflow := b.inflow("2026-10-20", 12000)

	mustReimburse(t, b.h, inflow, 1, alloc(expense, 10000))

	got := getReimbursed(t, b.h, inflow)
	if got.amountOn(b.nubank) != 12000 || got.amountOn(b.car) != -10000 || got.amountOn(b.sys["uncategorized_income"]) != -2000 {
		t.Fatalf("inflow = %+v", got)
	}
}

// S114: replacing the allocations of a transaction counts what the others hold, not its own (A117).
func TestReimbursementReplaceUsesHeldByOthers_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-10", 20000)
	first, second := b.inflow("2026-10-15", 10000), b.inflow("2026-10-16", 12000)
	mustReimburse(t, b.h, first, 1, alloc(expense, 10000))
	mustReimburse(t, b.h, second, 1, alloc(expense, 10000))

	r := reimburse(b.h, second, 2, alloc(expense, 10001))
	b.h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "allocations[0].original_id")
	if !strings.Contains(string(r.Body), "20001") {
		t.Fatalf("detail does not name the total: %s", r.Body)
	}
	mustReimburse(t, b.h, second, 2, alloc(expense, 10000))

	got := getReimbursed(t, b.h, second)
	if got.Version != 3 || len(got.Links) != 1 || got.held(expense) != 10000 || got.amountOn(b.car) != -10000 {
		t.Fatalf("second = %+v", got)
	}
}

// S114: an empty list takes the reimbursement back; it is refused when there is none (A117).
func TestReimbursementEmptyListUndoes_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-17", 10000)
	inflow, other := b.inflow("2026-10-20", 10000), b.inflow("2026-10-21", 10000)
	mustReimburse(t, b.h, inflow, 1, alloc(expense, 10000))

	mustReimburse(t, b.h, inflow, 2)

	got := getReimbursed(t, b.h, inflow)
	if len(got.Links) != 0 || got.amountOn(b.car) != 0 || got.amountOn(b.sys["uncategorized_income"]) != -10000 {
		t.Fatalf("inflow = %+v", got)
	}
	b.h.ExpectProblem(reimburse(b.h, other, 1), http.StatusUnprocessableEntity, "validation_failed", "allocations")
}

// S114: a voided reimbursement frees the amount it held (A117).
func TestReimbursementVoidFreesRemaining_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-17", 1500)
	first, second := b.inflow("2026-10-18", 1500), b.inflow("2026-10-19", 1500)

	mustReimburse(t, b.h, first, 1, alloc(expense, 1500))
	b.h.ExpectProblem(reimburse(b.h, second, 1, alloc(expense, 1500)), http.StatusUnprocessableEntity, "validation_failed", "allocations[0].original_id")
	b.h.MustDo(http.MethodPost, "/api/v1/transactions/"+first+"/void", map[string]string{"reason": "wrong"}, http.StatusOK, nil)

	mustReimburse(t, b.h, second, 1, alloc(expense, 1500))
}

// S114: naming a category moves the expense and its reimbursement together (A117).
func TestReimbursementCategoryMovesExpense_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-17", 1500)
	inflow := b.inflow("2026-10-20", 1500)

	mustReimburse(t, b.h, inflow, 1, allocIn(expense, 1500, b.maintain))

	if got := getReimbursed(t, b.h, expense); got.Version != 2 || got.amountOn(b.maintain) != 1500 || got.amountOn(b.car) != 0 {
		t.Fatalf("expense = %+v", got)
	}
	if got := getReimbursed(t, b.h, inflow); got.amountOn(b.maintain) != -1500 || got.amountOn(b.car) != 0 {
		t.Fatalf("inflow = %+v", got)
	}
}

// S114: operations the rule refuses (A117).
func TestReimbursementRejects_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	usd := b.h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})
	usdFood := b.h.Account("Food USD", "expense", "", map[string]any{"currency": "USD"})
	usdExpense := b.h.Record("2026-10-17",
		map[string]any{"account_id": usd, "amount": map[string]any{"amount": -1500, "currency": "USD"}, "weight": apitest.BRL(-8250)},
		map[string]any{"account_id": usdFood, "amount": map[string]any{"amount": 1500, "currency": "USD"}, "weight": apitest.BRL(8250)},
	)
	expense, second := b.expense("2026-10-17", 1500), b.expense("2026-10-17", 1500)
	voidedExpense := b.expense("2026-10-17", 1500)
	b.h.MustDo(http.MethodPost, "/api/v1/transactions/"+voidedExpense+"/void", map[string]string{"reason": "x"}, http.StatusOK, nil)
	voidedInflow := b.inflow("2026-10-20", 1500)
	b.h.MustDo(http.MethodPost, "/api/v1/transactions/"+voidedInflow+"/void", map[string]string{"reason": "x"}, http.StatusOK, nil)
	salary := b.h.Account("Salary", "income", "", nil)
	income := b.h.Record("2026-10-05", apitest.Posting(b.nubank, 1500), apitest.Posting(salary, -1500))
	inflow := b.inflow("2026-10-20", 1500)
	outflow := b.expense("2026-10-20", 1500)
	const unknown = "00000000-0000-7000-8000-000000000000"

	tests := []struct {
		name    string
		id      string
		version int
		allocs  []map[string]any
		status  int
		code    string
		field   string
	}{
		{"voided inflow", voidedInflow, 1, []map[string]any{alloc(expense, 1500)}, http.StatusConflict, "transaction_voided", ""},
		{"voided expense", inflow, 1, []map[string]any{alloc(voidedExpense, 1500)}, http.StatusConflict, "transaction_voided", ""},
		{"outflow", outflow, 1, []map[string]any{alloc(expense, 1500)}, http.StatusUnprocessableEntity, "not_categorizable", ""},
		{"income original", inflow, 1, []map[string]any{alloc(income, 1500)}, http.StatusUnprocessableEntity, "validation_failed", "allocations[0].original_id"},
		{"same transaction", inflow, 1, []map[string]any{alloc(inflow, 1500)}, http.StatusUnprocessableEntity, "validation_failed", "allocations[0].original_id"},
		{"foreign currency", inflow, 1, []map[string]any{alloc(usdExpense, 1500)}, http.StatusUnprocessableEntity, "validation_failed", "allocations[0].original_id"},
		{"duplicate expense", inflow, 1, []map[string]any{alloc(expense, 500), alloc(expense, 500)}, http.StatusUnprocessableEntity, "validation_failed", "allocations[1].original_id"},
		{"zero amount", inflow, 1, []map[string]any{alloc(expense, 0)}, http.StatusUnprocessableEntity, "validation_failed", "allocations[0].amount"},
		{"above the inflow", inflow, 1, []map[string]any{alloc(expense, 1000), alloc(second, 1000)}, http.StatusUnprocessableEntity, "validation_failed", "allocations"},
		{"stale version", inflow, 7, []map[string]any{alloc(expense, 1500)}, http.StatusConflict, "version_conflict", ""},
		{"unknown expense", inflow, 1, []map[string]any{alloc(unknown, 1500)}, http.StatusNotFound, "not_found", ""},
		{"unknown transaction", unknown, 1, []map[string]any{alloc(expense, 1500)}, http.StatusNotFound, "not_found", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b.h.ExpectProblem(reimburse(b.h, tt.id, tt.version, tt.allocs...), tt.status, tt.code, tt.field)
		})
	}
}

// S114: recategorizing the expense later leaves the reimbursement where it was (A117).
func TestReimbursementThenRecategorizeOriginalKeepsReimbursement_S114(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-17", 1500)
	inflow := b.inflow("2026-10-20", 1500)
	mustReimburse(t, b.h, inflow, 1, alloc(expense, 1500))

	if r := categorize(b.h, expense, 1, part(b.maintain, 1500)); r.Status != http.StatusOK {
		t.Fatalf("categorize status %d: %s", r.Status, r.Body)
	}

	if got := getReimbursed(t, b.h, inflow); got.amountOn(b.car) != -1500 || got.amountOn(b.maintain) != 0 {
		t.Fatalf("inflow = %+v", got)
	}
}
