package ledger_test

import (
	"net/http"
	"testing"
)

// TestRecordBrokerageNoteToolS427 records the note of S427 through the tool: the costs of 2.51
// split 1.25 and 1.26 by the gross of each purchase.
func TestRecordBrokerageNoteToolS427(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", security("VALE3", "stock"),
		http.StatusCreated, nil)
	args := f.noteToolArgs(
		map[string]any{
			"side":       "buy",
			"instrument": "PETR4",
			"quantity":   "100",
			"unit_price": "30.00",
		},
		map[string]any{
			"side":       "buy",
			"instrument": "VALE3",
			"quantity":   "50",
			"unit_price": "60.10",
		},
	)

	p := previewTool(t, f.h, "record_brokerage_note", args)

	if p.Target != "XP" || p.Changes[0].After.Text != "2" || p.Changes[1].After.Amount != "2.51" {
		t.Fatalf("preview = %+v", p)
	}

	var out struct {
		TransactionIDs []string `json:"transaction_ids"`
	}
	toolOutput(t, f.h, "record_brokerage_note", args, &out)

	if len(out.TransactionIDs) != 2 {
		t.Fatalf("transactions = %v, want 2", out.TransactionIDs)
	}

	for i, want := range []int64{-300125, -300626} {
		if got := amountsByAccount(f.h.Transaction(out.TransactionIDs[i])); got[f.cash] != want {
			t.Fatalf("cash of order %d = %d, want %d", i, got[f.cash], want)
		}
	}
}

func TestRecordBrokerageNoteToolErrors(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	order := func(quantity, price string) map[string]any {
		return map[string]any{
			"side": "buy", "instrument": "PETR4", "quantity": quantity, "unit_price": price,
		}
	}

	f.h.ExpectToolError(
		f.h.Tool("record_brokerage_note", f.noteToolArgs(order("x", "30.00"))),
		"invalid_arguments",
		"orders[0].quantity",
	)
	f.h.ExpectToolError(
		f.h.Tool("record_brokerage_note", f.noteToolArgs(order("100", "x"))),
		"invalid_arguments",
		"orders[0].unit_price",
	)
	f.h.ExpectToolError(
		f.h.Tool("record_brokerage_note", f.noteToolArgs()),
		"validation_failed",
		"orders",
	)
}

func (f investFixture) noteToolArgs(orders ...map[string]any) map[string]any {
	if orders == nil {
		orders = []map[string]any{}
	}

	return map[string]any{
		"brokerage_id": f.xp,
		"date":         "2026-11-10",
		"fees":         "2.51",
		"orders":       orders,
	}
}
