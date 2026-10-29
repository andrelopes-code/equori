package ledger_test

import (
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestCorrectInstallmentPurchaseDetails(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-25")
	id := toolInstallmentPurchase(t, c, "2026-10-20", "1000.00", 3)
	before := c.h.Transaction(id)

	c.h.MustDo(http.MethodPut, "/api/v1/transactions/"+id, correctionOf(before, "Volante (6x)", "2026-10-20", 0), http.StatusOK, nil)

	after := c.h.Transaction(id)
	if after.Version != 2 || after.Description != "Volante (6x)" || !reflect.DeepEqual(after.Postings, before.Postings) {
		t.Fatalf("after = %+v, before = %+v", after, before)
	}
	if got := statementDescriptions(t, c, "2026-11"); len(got) != 1 || got[0] != "Volante (6x)" {
		t.Errorf("statement descriptions = %v", got)
	}
}

func TestCorrectInstallmentPurchaseRefusesPostingsAndDate(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name        string
		description string
		date        string
		delta       int64
	}{
		{"amount", "Laptop", "2026-10-20", 100},
		{"description and amount", "Volante", "2026-10-20", 100},
		{"description and date", "Volante", "2026-10-21", 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			c := newCardSetup(t, "2026-10-25")
			id := toolInstallmentPurchase(t, c, "2026-10-20", "1000.00", 3)
			before := c.h.Transaction(id)

			r := c.h.Do(http.MethodPut, "/api/v1/transactions/"+id, correctionOf(before, tt.description, tt.date, tt.delta))

			c.h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "transaction_id")
			if after := c.h.Transaction(id); !reflect.DeepEqual(after, before) {
				t.Errorf("after = %+v, want %+v", after, before)
			}
		})
	}
}

func TestChangeTransactionCorrectInstallmentDescription(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-25")
	id := toolInstallmentPurchase(t, c, "2026-10-20", "1000.00", 3)
	args := map[string]any{"transaction_id": id, "action": "correct", "description": "Volante (6x)", "reason": "item"}

	var out writeOut
	toolOutput(t, c.h, "change_transaction", args, &out)

	if out.TransactionID != id || out.Version != 2 || c.h.Transaction(id).Description != "Volante (6x)" {
		t.Errorf("out = %+v", out)
	}
}

func TestChangeTransactionCorrectInstallmentRefusesAmount(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-25")
	id := toolInstallmentPurchase(t, c, "2026-10-20", "1000.00", 3)
	args := map[string]any{"transaction_id": id, "action": "correct", "description": "Volante", "amount": "900.00", "reason": "item"}

	c.h.ExpectToolError(c.h.Tool("change_transaction", args), "invalid_arguments", "amount")

	if got := c.h.Transaction(id); got.Version != 1 || got.Description != "Laptop" {
		t.Errorf("transaction = %+v", got)
	}
}

// correctionOf is the PUT body that resends v with a description and date, and with delta
// added to its first posting and to its last.
func correctionOf(v apitest.TransactionView, description, date string, delta int64) map[string]any {
	postings := make([]map[string]any, len(v.Postings))
	for i, p := range v.Postings {
		postings[i] = apitest.Posting(p.AccountID, p.Amount.Amount)
	}
	if delta != 0 {
		postings[0] = apitest.Posting(v.Postings[0].AccountID, v.Postings[0].Amount.Amount-delta)
		last := v.Postings[len(v.Postings)-1]
		postings[len(postings)-1] = apitest.Posting(last.AccountID, last.Amount.Amount+delta)
	}
	return map[string]any{
		"date":             date,
		"description":      description,
		"postings":         postings,
		"expected_version": v.Version,
		"reason":           "item",
	}
}

func statementDescriptions(t *testing.T, c cardSetup, month string) []string {
	t.Helper()
	var detail struct {
		Postings []struct {
			Description string `json:"description"`
		} `json:"postings"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/statements/"+statements(t, c.h, c.card)[month].ID, nil, http.StatusOK, &detail)
	out := make([]string, len(detail.Postings))
	for i, p := range detail.Postings {
		out[i] = p.Description
	}
	return out
}
