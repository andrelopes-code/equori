package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// A210: the opening date of an account moves earlier, so history before it can be recorded;
// it never moves later.
func TestAccountOpenedOnMovesEarlier(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Checking", "asset", "checking", map[string]any{"opened_on": "2026-06-01"})
	food := h.Account("Food", "expense", "", nil)
	tx := map[string]any{
		"date":        "2026-05-10",
		"description": "groceries",
		"postings":    []map[string]any{apitest.Posting(checking, -1000), apitest.Posting(food, 1000)},
	}

	if r := h.Do(http.MethodPost, "/api/v1/transactions", tx); r.Status != http.StatusUnprocessableEntity {
		t.Fatalf("transaction before the opening date: status %d, want 422: %s", r.Status, r.Body)
	}

	var got struct {
		OpenedOn string `json:"opened_on"`
	}
	h.MustDo(http.MethodPatch, "/api/v1/accounts/"+checking, map[string]any{"opened_on": "2026-05-01"}, http.StatusOK, &got)

	if got.OpenedOn != "2026-05-01" {
		t.Fatalf("opened_on = %s, want 2026-05-01", got.OpenedOn)
	}

	h.MustDo(http.MethodPost, "/api/v1/transactions", tx, http.StatusCreated, nil)

	r := h.Do(http.MethodPatch, "/api/v1/accounts/"+checking, map[string]any{"opened_on": "2026-05-02"})
	if r.Status != http.StatusUnprocessableEntity {
		t.Fatalf("later opening date: status %d, want 422: %s", r.Status, r.Body)
	}
}
