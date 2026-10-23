package ledger_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func TestChangeTransactionCorrect(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	id := f.h.Record("2026-10-20", apitest.Posting(f.checking, -12000), apitest.Posting(f.food, 12000))
	args := map[string]any{"transaction_id": id, "action": "correct", "amount": "130.00", "reason": "typo"}
	p := previewTool(t, f.h, "change_transaction", args)
	want := tool.Change{Field: "amount", Before: tool.Value{Amount: "120.00", Currency: "BRL"}, After: tool.Value{Amount: "130.00", Currency: "BRL"}}
	if !slices.Contains(p.Changes, want) || p.Basis != "v1" {
		t.Fatalf("preview = %+v", p)
	}
	var out writeOut
	toolOutput(t, f.h, "change_transaction", args, &out)
	if out.Version != 2 || !slices.Equal(postingAmounts(t, f.h, id), []int64{-13000, 13000}) {
		t.Errorf("out = %+v", out)
	}
	var got getTransactionOut
	toolOutput(t, f.h, "get_transaction", map[string]any{"transaction_id": id}, &got)
	if len(got.History) != 1 || got.History[0].Reason != "typo" {
		t.Errorf("history = %+v", got.History)
	}
	delete(args, "reason")
	f.h.ExpectToolError(f.h.Tool("change_transaction", args), "invalid_arguments", "reason")
}

func TestChangeTransactionCorrectThreePostings(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	id := f.h.Record("2026-10-20", apitest.Posting(f.checking, -10000), apitest.Posting(f.food, 6000), apitest.Posting(f.transport, 4000))
	f.h.ExpectToolError(f.h.Tool("change_transaction", map[string]any{"transaction_id": id, "action": "correct", "amount": "90.00", "reason": "x"}), "invalid_arguments", "amount")
}

func TestChangeTransactionTransfer(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	id := f.h.Record("2026-10-20", apitest.Posting(f.checking, -5000), apitest.Posting(f.food, 5000))
	args := map[string]any{"transaction_id": id, "action": "make_transfer", "to_account_id": f.emergency}
	p := previewTool(t, f.h, "change_transaction", args)
	want := tool.Change{Field: "account", Before: tool.TextValue("Food"), After: tool.TextValue("Emergency fund")}
	if len(p.Changes) != 1 || p.Changes[0] != want {
		t.Fatalf("preview = %+v", p)
	}
	var out writeOut
	toolOutput(t, f.h, "change_transaction", args, &out)
	if !slices.Equal(postingAmounts(t, f.h, out.TransactionID), []int64{-5000, 5000}) {
		t.Errorf("out = %+v", out)
	}
	f.h.ExpectToolError(f.h.Tool("change_transaction", map[string]any{"transaction_id": id, "action": "make_transfer"}), "invalid_arguments", "to_account_id")
}

func TestChangeTransactionReimburse(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-17", 1500)
	inflow := b.inflow("2026-10-20", 1500)
	args := map[string]any{"transaction_id": inflow, "action": "reimburse", "allocations": []map[string]any{{"expense_id": expense, "amount": "15.00"}}}
	p := previewTool(t, b.h, "change_transaction", args)
	if len(p.Changes) != 2 || p.Changes[0].Field != "transaction" || p.Changes[1].After.Amount != "15.00" {
		t.Fatalf("preview = %+v", p)
	}
	var out writeOut
	toolOutput(t, b.h, "change_transaction", args, &out)
	if out.Version != 2 {
		t.Errorf("out = %+v", out)
	}
	b.h.ExpectToolError(b.h.Tool("change_transaction", map[string]any{"transaction_id": inflow, "action": "reimburse"}), "invalid_arguments", "allocations")
}

func TestChangeTransactionOtherUser(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	other := f.h.Login("other@example.com")
	var a, b, tx struct {
		ID string `json:"id"`
	}
	f.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "A", "class": "asset", "currency": "BRL", "kind": "checking"}).Decode(t, &a)
	f.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "B", "class": "expense", "currency": "BRL"}).Decode(t, &b)
	f.h.Call(other, http.MethodPost, "/api/v1/transactions", map[string]any{"date": "2026-10-20", "description": "x",
		"postings": []map[string]any{apitest.Posting(a.ID, -100), apitest.Posting(b.ID, 100)}}).Decode(t, &tx)
	f.h.ExpectToolError(f.h.Tool("change_transaction", map[string]any{"transaction_id": tx.ID, "action": "correct", "reason": "x"}), "not_found", "")
}
