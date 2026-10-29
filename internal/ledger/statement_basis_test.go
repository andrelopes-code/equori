package ledger_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// A136: a card posting is provisional while no line states its bill, its statement is not
// reconciled and it is dated within 10 days before its statement's closing. Statement
// 2026-11 closes on 2026-11-03 and is due on 2026-11-10.
func TestProvisionalStatement(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	ctx, uid := t.Context(), c.h.OwnerID()

	late := c.purchase("2026-11-01", 713)
	early := c.purchase("2026-10-20", 1000)
	chosen := c.h.Record("2026-11-01", ownerStatement(apitest.Posting(c.card, -500), "2026-11"), apitest.Posting(c.food, 500))
	deferred := c.h.Record("2026-11-02", ownerStatement(apitest.Posting(c.card, -5000), "2026-12"), apitest.Posting(c.food, 5000))
	line := imported(t, c.card, "2026-11-01", -1112)
	due := time.Date(2026, 11, 10, 0, 0, 0, 0, time.UTC)
	line.DueDate = &due
	billed, err := c.h.App.Ledger.RecordImported(ctx, uid, uuid.New(), line)
	if err != nil {
		t.Fatal(err)
	}
	correctDescription(c.h, billed.String())

	got := provisionalOf(t, c.h, statements(t, c.h, c.card)["2026-11"].ID)

	want := map[string]bool{late: true, early: false, chosen: true, billed.String(): false}
	for id, w := range want {
		if p, ok := got[id]; !ok || p != w {
			t.Errorf("transaction %s: provisional = %v (listed %v), want %v", id, p, ok, w)
		}
	}
	// S178: the statement the owner chose holds after 2026-11 closes.
	if s := c.h.Transaction(deferred).Postings[0].Statement; s != "2026-12" {
		t.Errorf("chosen statement = %s, want 2026-12", s)
	}

	if r := reconcileStatement(c, "2026-11", int64(statements(t, c.h, c.card)["2026-11"].AmountDue)); r.Status != http.StatusOK {
		t.Fatalf("reconcile status = %d", r.Status)
	}

	for id, p := range provisionalOf(t, c.h, statements(t, c.h, c.card)["2026-11"].ID) {
		if p {
			t.Errorf("transaction %s provisional on a reconciled statement", id)
		}
	}
}

func ownerStatement(p map[string]any, reference string) map[string]any {
	p["statement"] = reference
	return p
}

// correctDescription corrects only the description of a transaction, sending its postings
// without their statements.
func correctDescription(h *apitest.Harness, id string) {
	tx := h.Transaction(id)
	postings := make([]map[string]any, len(tx.Postings))
	for i, p := range tx.Postings {
		postings[i] = apitest.Posting(p.AccountID, p.Amount.Amount)
	}
	h.MustDo(http.MethodPut, "/api/v1/transactions/"+id, map[string]any{
		"date": tx.Date, "description": "renamed", "postings": postings,
		"expected_version": tx.Version, "reason": "rename",
	}, http.StatusOK, nil)
}

func provisionalOf(t *testing.T, h *apitest.Harness, statementID string) map[string]bool {
	t.Helper()
	var detail struct {
		Postings []struct {
			TransactionID string `json:"transaction_id"`
			Provisional   bool   `json:"provisional"`
		} `json:"postings"`
	}
	h.MustDo(http.MethodGet, "/api/v1/statements/"+statementID, nil, http.StatusOK, &detail)
	out := map[string]bool{}
	for _, p := range detail.Postings {
		out[p.TransactionID] = p.Provisional
	}
	return out
}

type differenceView struct {
	AmountDifference *struct {
		Amount int64 `json:"amount"`
	} `json:"amount_difference"`
	Proposal *struct {
		TransactionIDs []string `json:"transaction_ids"`
		Amount         struct {
			Amount int64 `json:"amount"`
		} `json:"amount"`
	} `json:"difference_proposal"`
	Rounding bool `json:"rounding_difference"`
}

// differenceSetup bills on statement 2026-11 (closing 2026-11-03) a charge of 7.13 a line's
// bill placed and a manual 7.13 of 2026-11-01, and records the institution's total as the
// amount due less shortBy.
func differenceSetup(t *testing.T, shortBy int64) (c cardSetup, statementID, manual string) {
	t.Helper()
	c = newCardSetup(t, "2026-11-12")
	line := imported(t, c.card, "2026-10-28", -713)
	due := time.Date(2026, 11, 10, 0, 0, 0, 0, time.UTC)
	line.DueDate = &due
	if _, err := c.h.App.Ledger.RecordImported(t.Context(), c.h.OwnerID(), uuid.New(), line); err != nil {
		t.Fatal(err)
	}
	manual = c.purchase("2026-11-01", 713)
	s := statements(t, c.h, c.card)["2026-11"]
	c.h.MustDo(http.MethodPut, "/api/v1/statements/"+s.ID+"/facts",
		map[string]any{"due_date": "2026-11-10", "total": apitest.BRL(int64(s.AmountDue) - shortBy)}, http.StatusOK, nil)
	return c, s.ID, manual
}

// S177 (A137).
func TestStatementDifferenceProposal_S177(t *testing.T) {
	t.Parallel()
	c, id, manual := differenceSetup(t, 713)
	var before differenceView
	c.h.MustDo(http.MethodGet, "/api/v1/statements/"+id, nil, http.StatusOK, &before)
	if p := before.Proposal; p == nil || len(p.TransactionIDs) != 1 || p.TransactionIDs[0] != manual || p.Amount.Amount != 713 {
		t.Fatalf("proposal = %+v", before.Proposal)
	}

	var after differenceView
	c.h.MustDo(http.MethodPost, "/api/v1/statements/"+id+"/defer", map[string]any{"transaction_ids": []string{manual}}, http.StatusOK, &after)

	if after.AmountDifference == nil || after.AmountDifference.Amount != 0 || after.Proposal != nil {
		t.Fatalf("after the move = %+v", after)
	}
	if s := c.h.Transaction(manual).Postings[0].Statement; s != "2026-12" {
		t.Fatalf("moved charge on %s, want 2026-12", s)
	}
}

// S179 (A137).
func TestStatementRoundingDifference_S179(t *testing.T) {
	t.Parallel()
	c, id, _ := differenceSetup(t, 1)
	var got differenceView

	c.h.MustDo(http.MethodGet, "/api/v1/statements/"+id, nil, http.StatusOK, &got)

	if !got.Rounding || got.Proposal != nil {
		t.Fatalf("difference = %+v, want a rounding difference without proposal", got)
	}
}

func TestDeferStatementPostingsProblems(t *testing.T) {
	t.Parallel()
	c, id, manual := differenceSetup(t, 713)
	other := c.purchase("2026-11-20", 500)
	c.h.ExpectProblem(c.h.Do(http.MethodPost, "/api/v1/statements/"+id+"/defer", map[string]any{"transaction_ids": []string{other}}),
		http.StatusUnprocessableEntity, "posting_not_movable", "")

	if r := reconcileStatement(c, "2026-11", int64(statements(t, c.h, c.card)["2026-11"].AmountDue)); r.Status != http.StatusOK {
		t.Fatalf("reconcile status = %d", r.Status)
	}

	c.h.ExpectProblem(c.h.Do(http.MethodPost, "/api/v1/statements/"+id+"/defer", map[string]any{"transaction_ids": []string{manual}}),
		http.StatusConflict, "posting_reconciled", "")
}

// A136: a correction that sends the statement a posting already has keeps its basis; a
// statement the date chose is chosen again by a later date.
func TestCorrectionKeepsDateBasis(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	id := c.purchase("2026-11-01", 713)
	tx := c.h.Transaction(id)
	c.h.MustDo(http.MethodPut, "/api/v1/transactions/"+id, map[string]any{
		"date": "2026-11-01", "description": "same statement", "expected_version": tx.Version, "reason": "edit",
		"postings": []map[string]any{ownerStatement(apitest.Posting(c.card, -713), "2026-11"), apitest.Posting(c.food, 713)},
	}, http.StatusOK, nil)

	tx = c.h.Transaction(id)
	c.h.MustDo(http.MethodPut, "/api/v1/transactions/"+id, map[string]any{
		"date": "2026-11-05", "description": "later", "expected_version": tx.Version, "reason": "edit",
		"postings": []map[string]any{apitest.Posting(c.card, -713), apitest.Posting(c.food, 713)},
	}, http.StatusOK, nil)

	if s := c.h.Transaction(id).Postings[0].Statement; s != "2026-12" {
		t.Fatalf("statement after the date moved = %s, want 2026-12", s)
	}
}
