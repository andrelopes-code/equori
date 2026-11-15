package ledger_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func TestVoidTransactionTool(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	id := f.h.Record("2026-10-20", apitest.Posting(f.checking, -100), apitest.Posting(f.food, 100))

	args := map[string]any{"transaction_id": id, "reason": "duplicate"}
	p := previewTool(t, f.h, "void_transaction", args)

	wantItems := []tool.Item{{
		Description: "test",
		Date:        "2026-10-20",
		Amount:      tool.Value{Amount: "-1.00", Currency: "BRL"},
		Account:     "Nubank checking",
		Category:    "Food",
	}}
	if !p.Destructive || p.Basis != "v1" || p.Target != "test" || len(p.Changes) != 1 ||
		p.Changes[0].Field != "reason" || p.Changes[0].After.Text != "duplicate" ||
		!slices.Equal(p.Items, wantItems) {
		t.Fatalf("preview = %+v", p)
	}

	var out struct {
		Voided bool `json:"voided"`
	}
	toolOutput(t, f.h, "void_transaction", args, &out)
	var tx struct {
		VoidedAt string `json:"voided_at"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/transactions/"+id, nil, http.StatusOK, &tx)

	if !out.Voided || tx.VoidedAt == "" {
		t.Errorf("out = %+v, voided_at = %q", out, tx.VoidedAt)
	}

	f.h.ExpectToolError(
		f.h.Tool("void_transaction", map[string]any{"transaction_id": id, "reason": ""}),
		"invalid_arguments",
		"reason",
	)
}

func TestVoidTransactionOtherUser(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-10-23"))
	other := f.h.Login("other@example.com")
	var a, b, tx struct {
		ID string `json:"id"`
	}
	f.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "A", "class": "asset", "currency": "BRL", "kind": "checking"}).
		Decode(t, &a)
	f.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "B", "class": "expense", "currency": "BRL"}).
		Decode(t, &b)
	f.h.Call(other, http.MethodPost, "/api/v1/transactions", map[string]any{
		"date":        "2026-10-20",
		"description": "x",
		"postings": []map[string]any{
			apitest.Posting(a.ID, -100),
			apitest.Posting(b.ID, 100),
		},
	}).
		Decode(t, &tx)
	f.h.ExpectToolError(
		f.h.Tool("void_transaction", map[string]any{"transaction_id": tx.ID, "reason": "x"}),
		"not_found",
		"",
	)
}
