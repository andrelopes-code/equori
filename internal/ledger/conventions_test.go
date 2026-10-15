package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// ADR 007, C6: a state transition answers 200 with the updated resource.
func TestTransitionsReturnTheResource(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	tx := h.Record("2026-10-01", apitest.Posting(checking, -100), apitest.Posting(food, 100))

	var voided struct {
		ID       string `json:"id"`
		VoidedAt string `json:"voided_at"`
	}
	h.MustDo(http.MethodPost, "/api/v1/transactions/"+tx+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, &voided)
	if voided.ID != tx || voided.VoidedAt == "" {
		t.Fatalf("void = %+v", voided)
	}

	var closed struct {
		ID       string `json:"id"`
		ClosedOn string `json:"closed_on"`
	}
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+checking+"/close", map[string]string{"closed_on": "2026-10-31"}, http.StatusOK, &closed)
	if closed.ID != checking || closed.ClosedOn != "2026-10-31" {
		t.Fatalf("close = %+v", closed)
	}

	r := newReserveSetup(t)
	assertBalance(r.h, r.reserve, "2026-10-31", 1000000)
	var status reconciliationStatus
	r.h.MustDo(http.MethodPost, "/api/v1/accounts/"+r.reserve+"/unlock", map[string]string{"from": "2026-10-01"}, http.StatusOK, &status)
	if status.LastReconciledOn != "" || status.OpenDifference == nil {
		t.Fatalf("unlock = %+v", status)
	}

	c := newCardSetup(t, "2026-11-05")
	c.purchase("2026-10-14", 100000)
	var detail struct {
		ID         string `json:"id"`
		Reconciled bool   `json:"reconciled"`
	}
	id := statements(t, c.h, c.card)["2026-11"].ID
	c.h.MustDo(http.MethodPost, "/api/v1/statements/"+id+"/reconcile", map[string]any{"amount_due": apitest.BRL(100000)}, http.StatusOK, &detail)
	if detail.ID != id {
		t.Fatalf("reconcile = %+v", detail)
	}
}

// ADR 007, C6: a created record with a GET endpoint is located by the Location header.
func TestCreatedRecordsHaveLocation(t *testing.T) {
	c := newCardSetup(t, "2026-11-12")
	purchase := c.purchase("2026-10-14", 100000)
	statement := statements(t, c.h, c.card)["2026-11"].ID
	for _, tc := range []struct {
		name string
		r    apitest.Response
	}{
		{"account", c.h.Do(http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Wallet", "class": "asset", "kind": "cash", "currency": "BRL"})},
		{"transaction", c.h.Do(http.MethodPost, "/api/v1/transactions", map[string]any{"date": "2026-10-02", "postings": []map[string]any{apitest.Posting(c.checking, -5), apitest.Posting(c.food, 5)}})},
		{"refund", c.h.Do(http.MethodPost, "/api/v1/transactions/"+purchase+"/refunds", map[string]any{"date": "2026-10-20", "amount": apitest.BRL(1000)})},
		{"payment", c.h.Do(http.MethodPost, "/api/v1/statements/"+statement+"/payments", map[string]any{"date": "2026-11-10", "from_account_id": c.checking, "amount": apitest.BRL(99000)})},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.r.Status != http.StatusCreated {
				t.Fatalf("status %d: %s", tc.r.Status, tc.r.Body)
			}
			var created idOnly
			tc.r.Decode(t, &created)
			loc := tc.r.Header.Get("Location")
			var located idOnly
			c.h.MustDo(http.MethodGet, loc, nil, http.StatusOK, &located)
			if located.ID != created.ID {
				t.Fatalf("Location %q resolves to %q, want %q", loc, located.ID, created.ID)
			}
		})
	}
}
