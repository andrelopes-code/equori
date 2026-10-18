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
	c.h.MustDo(http.MethodPost, "/api/v1/disputes/"+d.ID+"/resolve",
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
	c.h.ExpectProblem(c.h.Do(http.MethodPost, "/api/v1/disputes/"+d.ID+"/resolve",
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
	c.h.MustDo(http.MethodPost, "/api/v1/disputes/"+d.ID+"/resolve",
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

type disputeListView struct {
	Items []struct {
		ID                  string  `json:"id"`
		TransactionID       string  `json:"transaction_id"`
		OpenedOn            string  `json:"opened_on"`
		Outcome             *string `json:"outcome"`
		RefundTransactionID *string `json:"refund_transaction_id"`
	} `json:"items"`
}

func listDisputes(t *testing.T, c cardSetup, tx string) disputeListView {
	t.Helper()
	r := c.h.Do(http.MethodGet, "/api/v1/transactions/"+tx+"/disputes", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("list disputes status = %d, body = %s", r.Status, r.Body)
	}
	var out disputeListView
	r.Decode(t, &out)
	return out
}

// S13: the disputes of a transaction are listed with their outcome and refund.
func TestListDisputesS13(t *testing.T) {
	c := newCardSetup(t, "2026-12-05")
	charge := c.purchase("2026-10-14", 19990)

	if got := listDisputes(t, c, charge); got.Items == nil || len(got.Items) != 0 {
		t.Fatalf("before any dispute items = %#v, want empty array", got.Items)
	}

	d := openDispute(t, c.h, charge)
	open := listDisputes(t, c, charge)
	if len(open.Items) != 1 {
		t.Fatalf("open items = %+v", open.Items)
	}
	if it := open.Items[0]; it.ID != d.ID || it.TransactionID != charge || it.OpenedOn != "2026-11-05" || it.Outcome != nil || it.RefundTransactionID != nil {
		t.Fatalf("open dispute = %+v", it)
	}

	var resolved disputeView
	c.h.MustDo(http.MethodPost, "/api/v1/disputes/"+d.ID+"/resolve",
		map[string]any{"resolved_on": "2026-12-02", "outcome": "won", "statement": "2026-12"}, http.StatusOK, &resolved)
	won := listDisputes(t, c, charge)
	if len(won.Items) != 1 {
		t.Fatalf("won items = %+v", won.Items)
	}
	if it := won.Items[0]; it.Outcome == nil || *it.Outcome != "won" || it.RefundTransactionID == nil || *it.RefundTransactionID != resolved.RefundTransactionID {
		t.Fatalf("won dispute = %+v, refund = %q", it, resolved.RefundTransactionID)
	}

	other := c.h.Login("other@example.com")
	c.h.ExpectProblem(c.h.Call(other, http.MethodGet, "/api/v1/transactions/"+charge+"/disputes", nil), http.StatusNotFound, "not_found", "")
	c.h.ExpectProblem(c.h.Do(http.MethodGet, "/api/v1/transactions/00000000-0000-4000-8000-000000000000/disputes", nil), http.StatusNotFound, "not_found", "")
}
