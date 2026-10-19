package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type accountView struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ParentID string `json:"parent_id"`
	ClosedOn string `json:"closed_on"`
}

func getAccount(t *testing.T, h *apitest.Harness, id string) accountView {
	t.Helper()
	var out accountView
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+id, nil, http.StatusOK, &out)
	return out
}

// S72: an account cannot move under its own descendant (A73).
func TestMoveUnderDescendantIs422(t *testing.T) {
	h := apitest.New(t)
	food := h.Account("Food", "expense", "", nil)
	groceries := h.Account("Groceries", "expense", "", map[string]any{"parent_id": food})
	organic := h.Account("Organic", "expense", "", map[string]any{"parent_id": groceries})

	for _, target := range []string{groceries, organic} {
		h.ExpectProblem(h.Do(http.MethodPatch, "/api/v1/accounts/"+food, map[string]any{"parent_id": target}),
			http.StatusUnprocessableEntity, "validation_failed", "parent_id")
	}
	if a := getAccount(t, h, food); a.ParentID != "" {
		t.Fatalf("food parent = %q", a.ParentID)
	}
	if a := getAccount(t, h, groceries); a.ParentID != food {
		t.Fatalf("groceries parent = %q, want food", a.ParentID)
	}
}
