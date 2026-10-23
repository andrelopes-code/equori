package ledger_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type purchaseOut struct {
	TransactionID string `json:"transaction_id"`
}

// TestHandleCardPurchaseRefundS08 follows the full refund of S08.
func TestHandleCardPurchaseRefundS08(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-25")
	id := c.purchase("2026-10-20", 23000)
	args := map[string]any{"transaction_id": id, "action": "refund", "date": "2026-10-25", "amount": "230.00"}
	p := previewTool(t, c.h, "handle_card_purchase", args)
	if p.Target != "Purchase test of 2026-10-20" || p.Basis != "v1" || p.Changes[0].Field != "amount" || p.Changes[0].After.Amount != "230.00" {
		t.Fatalf("preview = %+v", p)
	}
	var out purchaseOut
	toolOutput(t, c.h, "handle_card_purchase", args, &out)
	tx := c.h.Transaction(out.TransactionID)
	if card := cardPostings(tx, c.card)[0]; card.Amount.Amount != 23000 || card.Statement != "2026-11" {
		t.Fatalf("refund posting = %+v", card)
	}
	if amountsByAccount(tx)[c.food] != -23000 {
		t.Fatalf("refund category = %v", amountsByAccount(tx))
	}
	c.h.ExpectToolError(c.h.Tool("handle_card_purchase", map[string]any{"transaction_id": id, "action": "refund", "date": "2026-10-26", "amount": "1.00"}), "validation_failed", "")
}

// TestHandleCardPurchaseDisputeS13 follows the won chargeback of S13.
func TestHandleCardPurchaseDisputeS13(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-12-05")
	id := c.purchase("2026-10-14", 19990)
	c.h.ExpectToolError(c.h.Tool("handle_card_purchase", map[string]any{"transaction_id": id, "action": "resolve_dispute", "outcome": "won"}), "invalid_arguments", "transaction_id")
	var out purchaseOut
	toolOutput(t, c.h, "handle_card_purchase", map[string]any{"transaction_id": id, "action": "open_dispute", "date": "2026-11-05"}, &out)
	resolve := map[string]any{"transaction_id": id, "action": "resolve_dispute", "outcome": "won", "date": "2026-12-02", "statement": "2026-12"}
	previewTool(t, c.h, "handle_card_purchase", resolve)
	toolOutput(t, c.h, "handle_card_purchase", resolve, &out)
	tx := c.h.Transaction(out.TransactionID)
	if card := cardPostings(tx, c.card)[0]; card.Amount.Amount != 19990 || card.Statement != "2026-12" || card.CardRole != "credit" {
		t.Fatalf("chargeback posting = %+v", card)
	}
}

func toolInstallmentPurchase(t *testing.T, c cardSetup, date, amount string, count int) string {
	t.Helper()
	var out purchaseOut
	toolOutput(t, c.h, "record_transaction", map[string]any{"date": date, "description": "Laptop", "amount": amount, "from_account_id": c.card, "to_account_id": c.food, "installments": count}, &out)
	return out.TransactionID
}

// TestHandleCardPurchaseCancelS14 follows the cancellation of S14.
func TestHandleCardPurchaseCancelS14(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-25")
	id := toolInstallmentPurchase(t, c, "2026-10-14", "1000.00", 3)
	c.h.ExpectToolError(c.h.Tool("handle_card_purchase", map[string]any{"transaction_id": c.purchase("2026-10-15", 100), "action": "cancel_installments", "date": "2026-11-20"}), "invalid_arguments", "transaction_id")
	args := map[string]any{"transaction_id": id, "action": "cancel_installments", "date": "2026-11-20", "statement": "2026-12"}
	previewTool(t, c.h, "handle_card_purchase", args)
	var out purchaseOut
	toolOutput(t, c.h, "handle_card_purchase", args, &out)
	tx := c.h.Transaction(out.TransactionID)
	if got := amountsByAccount(tx); got[c.card] != 100000 || got[c.food] != -100000 {
		t.Fatalf("cancellation postings = %v", got)
	}
}

// TestHandleCardPurchaseAnticipateS15 follows the anticipation of S15.
func TestHandleCardPurchaseAnticipateS15(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2027-01-15")
	id := toolInstallmentPurchase(t, c, "2026-10-14", "2225.40", 10)
	args := map[string]any{"transaction_id": id, "action": "anticipate_installments", "date": "2027-01-15", "from_installment": 5, "to_installment": 10, "amount": "1260.00", "statement": "2027-02"}
	p := previewTool(t, c.h, "handle_card_purchase", args)
	if p.Changes[0].Field != "installments" || p.Changes[0].After.Text != "5-10" {
		t.Fatalf("preview = %+v", p)
	}
	var out purchaseOut
	toolOutput(t, c.h, "handle_card_purchase", args, &out)
	if got := amountsByAccount(c.h.Transaction(out.TransactionID)); got[c.card] != 7524 {
		t.Fatalf("anticipation postings = %v", got)
	}
}

func TestHandleCardPurchaseInvalidArguments(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-25")
	id := c.purchase("2026-10-20", 23000)
	c.h.ExpectToolError(c.h.Tool("handle_card_purchase", map[string]any{"transaction_id": id, "action": "refund"}), "invalid_arguments", "amount")
	c.h.ExpectToolError(c.h.Tool("handle_card_purchase", map[string]any{"transaction_id": id, "action": "open_dispute", "amount": "1.00"}), "invalid_arguments", "amount")
	plain := c.h.Record("2026-10-20", apitest.Posting(c.checking, -100), apitest.Posting(c.food, 100))
	c.h.ExpectToolError(c.h.Tool("handle_card_purchase", map[string]any{"transaction_id": plain, "action": "open_dispute"}), "invalid_arguments", "transaction_id")
}

func TestHandleCardPurchaseOtherUser(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-25")
	_, foreign, _ := otherUserCardPurchase(t, c.h)
	for _, args := range []map[string]any{
		{"transaction_id": foreign, "action": "refund", "amount": "1.00"},
		{"transaction_id": foreign, "action": "open_dispute"},
		{"transaction_id": foreign, "action": "resolve_dispute", "outcome": "won"},
		{"transaction_id": foreign, "action": "cancel_installments"},
		{"transaction_id": foreign, "action": "anticipate_installments", "amount": "1.00", "from_installment": 1, "to_installment": 1},
	} {
		c.h.ExpectToolError(c.h.Tool("handle_card_purchase", args), "not_found", "")
	}
}
