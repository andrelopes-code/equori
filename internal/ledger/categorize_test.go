package ledger_test

import (
	"encoding/json/v2"
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func categorize(h *apitest.Harness, id string, version int, parts ...map[string]any) apitest.Response {
	return h.Do(http.MethodPost, "/api/v1/transactions/"+id+"/categorize", map[string]any{"expected_version": version, "parts": parts})
}

func part(account string, amount int64) map[string]any {
	return map[string]any{"account_id": account, "amount": apitest.BRL(amount)}
}

type eventPayload struct {
	Version           int      `json:"version"`
	Origin            string   `json:"origin"`
	CategoryState     string   `json:"category_state"`
	CategoriesChanged bool     `json:"categories_changed"`
	AccountIDs        []string `json:"account_ids"`
	Cause             *struct {
		Method string `json:"method"`
		RuleID string `json:"rule_id"`
	} `json:"cause"`
}

func events(t *testing.T, h *apitest.Harness, transaction string) map[string][]eventPayload {
	t.Helper()
	rows, err := h.Pool.Query(t.Context(), `SELECT type, payload FROM outbox_event WHERE aggregate_id = $1 ORDER BY id`, transaction)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	out := map[string][]eventPayload{}
	for rows.Next() {
		var typ string
		var raw []byte
		if err := rows.Scan(&typ, &raw); err != nil {
			t.Fatal(err)
		}
		var p eventPayload
		if err := json.Unmarshal(raw, &p); err != nil {
			t.Fatal(err)
		}
		out[typ] = append(out[typ], p)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out
}

// S43: the category side of a transaction changes after its account is reconciled (P5 amendment A18).
func TestCategorizeReconciledTransaction(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-05"))
	sys := systemAccounts(h)
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	salary := h.Account("Salary", "income", "", nil)
	id := h.Record("2026-10-15", apitest.Posting(checking, 300000), apitest.Posting(sys["uncategorized_income"], -300000))
	if r := assertBalance(h, checking, "2026-10-31", 300000); r.Status != http.StatusCreated {
		t.Fatalf("assertion status %d: %s", r.Status, r.Body)
	}

	r := categorize(h, id, 1, part(salary, -300000))
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
	var tx apitest.TransactionView
	r.Decode(t, &tx)
	if tx.Version != 2 || len(tx.Postings) != 2 {
		t.Fatalf("transaction = %+v", tx)
	}
	for _, p := range tx.Postings {
		want := map[string]string{checking: "reconciled", salary: "cleared"}[p.AccountID]
		if want == "" || p.Status != want {
			t.Fatalf("posting %+v, want status %q", p, want)
		}
	}
	if s := reconciliationOf(h, checking); s.LastReconciledOn != "2026-10-31" {
		t.Fatalf("reconciliation = %+v", s)
	}

	var versions struct {
		Items []struct {
			Version int    `json:"version"`
			Reason  string `json:"reason"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+id+"/versions", nil, http.StatusOK, &versions)
	if len(versions.Items) != 1 || versions.Items[0].Version != 1 || versions.Items[0].Reason != "categorized" {
		t.Fatalf("versions = %+v", versions)
	}

	h.Dispatch()
	for account, want := range map[string]int64{salary: -300000, sys["uncategorized_income"]: 0} {
		var out struct {
			Items []struct {
				Date    string `json:"date"`
				Balance struct {
					Amount int64 `json:"amount"`
				} `json:"balance"`
			} `json:"items"`
		}
		h.MustDo(http.MethodGet, fmt.Sprintf("/api/v1/reports/balances?account_id=%s&from=2026-10-15&to=2026-10-15", account), nil, http.StatusOK, &out)
		if len(out.Items) != 1 || out.Items[0].Balance.Amount != want {
			t.Fatalf("series of %s = %+v, want %d", account, out.Items, want)
		}
	}
}

func TestCategorizeProblems(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-05"))
	sys := systemAccounts(h)
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	savings := h.Account("Savings", "asset", "savings", nil)
	food := h.Account("Food", "expense", "", nil)
	id := h.Record("2026-10-15", apitest.Posting(checking, -1000), apitest.Posting(sys["uncategorized_expense"], 1000))
	transfer := h.Record("2026-10-15", apitest.Posting(checking, -1000), apitest.Posting(savings, 1000))

	h.ExpectProblem(categorize(h, "00000000-0000-7000-8000-000000000000", 1, part(food, 1000)), http.StatusNotFound, "not_found", "")
	h.ExpectProblem(categorize(h, id, 2, part(food, 1000)), http.StatusConflict, "version_conflict", "")
	h.ExpectProblem(categorize(h, transfer, 1, part(food, 1000)), http.StatusUnprocessableEntity, "not_categorizable", "")
	h.ExpectProblem(categorize(h, id, 1, part(food, 999)), http.StatusUnprocessableEntity, "validation_failed", "parts")
	h.ExpectProblem(categorize(h, id, 1, part(savings, 1000)), http.StatusUnprocessableEntity, "validation_failed", "parts[0].account_id")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/transactions/"+id+"/categorize", map[string]any{
		"expected_version": 1, "parts": []any{part(food, 1000)}, "payee_id": "00000000-0000-7000-8000-000000000000",
	}), http.StatusUnprocessableEntity, "validation_failed", "payee_id")

	h.MustDo(http.MethodPost, "/api/v1/transactions/"+id+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)
	h.ExpectProblem(categorize(h, id, 1, part(food, 1000)), http.StatusConflict, "transaction_voided", "")
}

func TestCategorizeKeepsCardPurchase(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	sys := systemAccounts(c.h)
	id := c.h.Record("2026-10-14", apitest.Posting(c.card, -23000), apitest.Posting(sys["uncategorized_expense"], 23000))
	before := c.h.Transaction(id)

	c.h.MustDo(http.MethodPost, "/api/v1/transactions/"+id+"/categorize", map[string]any{
		"expected_version": 1, "parts": []any{part(c.food, 20000), part(sys["uncategorized_expense"], 3000)},
	}, http.StatusOK, nil)
	after := c.h.Transaction(id)
	if after.Postings[0] != before.Postings[0] || after.Postings[0].CardRole != "charge" || after.Postings[0].Statement != "2026-11" {
		t.Fatalf("card posting = %+v, want %+v", after.Postings[0], before.Postings[0])
	}
	if got := amountsByAccount(after); len(after.Postings) != 3 || got[c.food] != 20000 || got[sys["uncategorized_expense"]] != 3000 {
		t.Fatalf("postings = %+v", after.Postings)
	}
}

// Event payloads carry what Classification needs (P5 amendments A17, A18, A20).
func TestTransactionEventPayloads(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-05"))
	sys := systemAccounts(h)
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	id := h.Record("2026-10-15", apitest.Posting(checking, -1000), apitest.Posting(sys["uncategorized_expense"], 1000))
	if r := categorize(h, id, 1, part(food, 1000)); r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
	correct := func(version int, description string, postings ...map[string]any) {
		h.MustDo(http.MethodPut, "/api/v1/transactions/"+id, map[string]any{
			"date": "2026-10-15", "description": description, "postings": postings, "expected_version": version, "reason": "edit",
		}, http.StatusOK, nil)
	}
	correct(2, "renamed", apitest.Posting(checking, -1000), apitest.Posting(food, 1000))
	correct(3, "renamed", apitest.Posting(checking, -1000), apitest.Posting(sys["uncategorized_expense"], 1000))
	h.MustDo(http.MethodPost, "/api/v1/transactions/"+id+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)

	got := events(t, h, id)
	recorded, categorized := got["ledger.transaction_recorded.v1"], got["ledger.transaction_categorized.v1"]
	corrected, voided := got["ledger.transaction_corrected.v1"], got["ledger.transaction_voided.v1"]
	if len(recorded) != 1 || recorded[0].Version != 1 || recorded[0].Origin != "manual" || recorded[0].CategoryState != "uncategorized" || recorded[0].Cause != nil {
		t.Fatalf("recorded = %+v", recorded)
	}
	if len(categorized) != 1 || categorized[0].Version != 2 || categorized[0].CategoryState != "categorized" ||
		categorized[0].Cause == nil || categorized[0].Cause.Method != "manual" || categorized[0].Cause.RuleID != "" || len(categorized[0].AccountIDs) != 3 {
		t.Fatalf("categorized = %+v", categorized)
	}
	if len(corrected) != 2 || corrected[0].Version != 3 || corrected[0].CategoriesChanged || corrected[0].CategoryState != "categorized" ||
		corrected[1].Version != 4 || !corrected[1].CategoriesChanged || corrected[1].CategoryState != "uncategorized" {
		t.Fatalf("corrected = %+v", corrected)
	}
	if len(voided) != 1 || voided[0].Version != 4 || voided[0].Origin != "manual" {
		t.Fatalf("voided = %+v", voided)
	}
}
