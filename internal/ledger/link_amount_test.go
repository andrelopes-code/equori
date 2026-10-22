package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type amountLink struct {
	Type   string `json:"type"`
	Target string `json:"target"`
	Amount *struct {
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
	} `json:"amount"`
}

type linkedView struct {
	Version int          `json:"version"`
	Links   []amountLink `json:"links"`
	// ReferencedBy lists the inbound links of the transaction.
	ReferencedBy []struct {
		Type   string `json:"type"`
		Source string `json:"source"`
		Amount *struct {
			Amount int64 `json:"amount"`
		} `json:"amount"`
	} `json:"referenced_by"`
}

func linkedTransaction(t *testing.T, h *apitest.Harness, id string) linkedView {
	t.Helper()
	var out linkedView
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+id, nil, http.StatusOK, &out)
	return out
}

func inflowWithLink(b reimbursementBooks, original, linkType string, amount int64) apitest.Response {
	link := map[string]any{"type": linkType, "target": original}
	if amount != 0 {
		link["amount"] = apitest.BRL(amount)
	}
	return b.h.Do(http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-20", "description": "received",
		"postings": []map[string]any{apitest.Posting(b.nubank, 1500), apitest.Posting(b.car, -1500)},
		"links":    []map[string]any{link},
	})
}

// A117: a reimbursement link carries the amount it holds on the expense.
func TestReimbursementLinkAmountRoundTrips(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-17", 1500)

	r := inflowWithLink(b, expense, "reimbursement_of", 1000)
	if r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
	var created struct {
		ID string `json:"id"`
	}
	r.Decode(t, &created)

	got := linkedTransaction(t, b.h, created.ID)
	if len(got.Links) != 1 || got.Links[0].Amount == nil || got.Links[0].Amount.Amount != 1000 || got.Links[0].Amount.Currency != "BRL" {
		t.Fatalf("links = %+v, want amount 1000 BRL", got.Links)
	}
	original := linkedTransaction(t, b.h, expense)
	if len(original.ReferencedBy) != 1 || original.ReferencedBy[0].Amount == nil || original.ReferencedBy[0].Amount.Amount != 1000 {
		t.Fatalf("referenced_by = %+v, want amount 1000", original.ReferencedBy)
	}
}

func TestCorrectKeepsReimbursementLinkAmount(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-17", 1500)
	r := inflowWithLink(b, expense, "reimbursement_of", 1000)
	var created struct {
		ID string `json:"id"`
	}
	r.Decode(t, &created)

	put := b.h.Do(http.MethodPut, "/api/v1/transactions/"+created.ID, map[string]any{
		"date": "2026-10-20", "description": "renamed", "expected_version": 1, "reason": "rename",
		"postings": []map[string]any{apitest.Posting(b.nubank, 1500), apitest.Posting(b.car, -1500)},
		"links":    []map[string]any{{"type": "reimbursement_of", "target": expense, "amount": apitest.BRL(1000)}},
	})

	if put.Status != http.StatusOK {
		t.Fatalf("status %d: %s", put.Status, put.Body)
	}
	got := linkedTransaction(t, b.h, created.ID)
	if got.Version != 2 || len(got.Links) != 1 || got.Links[0].Amount == nil || got.Links[0].Amount.Amount != 1000 {
		t.Fatalf("after correction = %+v", got)
	}
}

func TestLinkAmountOnOtherTypeIsRejected(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-17", 1500)

	r := inflowWithLink(b, expense, "refund_of", 1000)

	b.h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "links[0].amount")
}

// A117: a correction that names no links keeps the ones the transaction has; an empty list clears them.
func TestCorrectWithoutLinksKeepsReimbursementLinks(t *testing.T) {
	t.Parallel()
	b := newReimbursementBooks(t)
	expense := b.expense("2026-10-17", 1500)
	inflow := b.inflow("2026-10-20", 1500)
	mustReimburse(t, b.h, inflow, 1, alloc(expense, 1500))
	correct := func(version int, extra map[string]any) apitest.Response {
		body := map[string]any{
			"date": "2026-10-20", "description": "renamed", "expected_version": version, "reason": "rename",
			"postings": []map[string]any{apitest.Posting(b.nubank, 1500), apitest.Posting(b.car, -1500)},
		}
		for k, v := range extra {
			body[k] = v
		}
		return b.h.Do(http.MethodPut, "/api/v1/transactions/"+inflow, body)
	}

	if r := correct(2, nil); r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
	got := linkedTransaction(t, b.h, inflow)
	if len(got.Links) != 1 || got.Links[0].Target != expense || got.Links[0].Amount == nil || got.Links[0].Amount.Amount != 1500 {
		t.Fatalf("links after a correction without links = %+v", got.Links)
	}

	if r := correct(3, map[string]any{"links": []map[string]any{}}); r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
	if got := linkedTransaction(t, b.h, inflow); len(got.Links) != 0 {
		t.Fatalf("links after an empty list = %+v", got.Links)
	}
}
