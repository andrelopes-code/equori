package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type disputeView struct {
	ID                  string `json:"id"`
	Outcome             string `json:"outcome"`
	RefundTransactionID string `json:"refund_transaction_id"`
}

func openDispute(t *testing.T, h *apitest.Harness, tx string) disputeView {
	t.Helper()
	var d disputeView
	h.MustDo(http.MethodPost, "/api/v1/transactions/"+tx+"/disputes", map[string]any{"opened_on": "2026-11-05"}, http.StatusCreated, &d)
	return d
}

func TestDisputeWon(t *testing.T) {
	c := newCardSetup(t, "2026-12-05")
	charge := c.purchase("2026-10-14", 19990)
	d := openDispute(t, c.h, charge)
	c.h.ExpectProblem(c.h.Do(http.MethodPost, "/api/v1/transactions/"+charge+"/disputes", map[string]any{"opened_on": "2026-11-06"}),
		http.StatusConflict, "dispute_open", "")

	var resolved disputeView
	c.h.MustDo(http.MethodPost, "/api/v1/disputes/"+d.ID+"/resolution",
		map[string]any{"resolved_on": "2026-12-02", "outcome": "won", "statement": "2026-12"}, http.StatusOK, &resolved)
	if resolved.Outcome != "won" || resolved.RefundTransactionID == "" {
		t.Fatalf("resolved = %+v", resolved)
	}
	refund := c.h.Transaction(resolved.RefundTransactionID)
	if card := cardPostings(refund, c.card)[0]; card.Amount.Amount != 19990 || card.Statement != "2026-12" || card.CardRole != "credit" {
		t.Fatalf("chargeback posting = %+v", card)
	}
	if amountsByAccount(refund)[c.food] != -19990 {
		t.Fatalf("chargeback category = %v", amountsByAccount(refund))
	}
	c.h.ExpectProblem(c.h.Do(http.MethodPost, "/api/v1/disputes/"+d.ID+"/resolution",
		map[string]any{"resolved_on": "2026-12-03", "outcome": "lost"}), http.StatusConflict, "dispute_resolved", "")
	c.h.ExpectProblem(refundAgain(c.h, charge), http.StatusUnprocessableEntity, "validation_failed", "amount")
}

func refundAgain(h *apitest.Harness, id string) apitest.Response {
	return h.Do(http.MethodPost, "/api/v1/transactions/"+id+"/refunds", map[string]any{"date": "2026-12-04", "amount": apitest.BRL(1)})
}

func TestDisputeLost(t *testing.T) {
	c := newCardSetup(t, "2026-12-05")
	charge := c.purchase("2026-10-14", 19990)
	d := openDispute(t, c.h, charge)
	var resolved disputeView
	c.h.MustDo(http.MethodPost, "/api/v1/disputes/"+d.ID+"/resolution",
		map[string]any{"resolved_on": "2026-12-02", "outcome": "lost"}, http.StatusOK, &resolved)
	if resolved.Outcome != "lost" || resolved.RefundTransactionID != "" {
		t.Fatalf("resolved = %+v", resolved)
	}
}

func TestDisputeOnNonCardTransactionIs422(t *testing.T) {
	c := newCardSetup(t, "2026-12-05")
	tx := c.h.Record("2026-10-14", apitest.Posting(c.checking, -100), apitest.Posting(c.food, 100))
	c.h.ExpectProblem(c.h.Do(http.MethodPost, "/api/v1/transactions/"+tx+"/disputes", map[string]any{"opened_on": "2026-11-05"}),
		http.StatusUnprocessableEntity, "validation_failed", "transaction_id")
}
