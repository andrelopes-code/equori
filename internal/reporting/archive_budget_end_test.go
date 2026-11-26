package reporting_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S752: an ended budget leaves the archive and comes back with its end (budget end E22).
func TestS752ArchiveCarriesBudgetEnd(t *testing.T) {
	t.Parallel()
	source := apitest.New(t, apitest.Today("2026-10-26"))
	family := source.Account("Family help", "expense", "", nil)
	var budget struct {
		ID string `json:"id"`
	}
	source.MustDo(http.MethodPost, "/api/v1/budgets", map[string]any{
		"category_id":    family,
		"amount":         apitest.BRL(42800),
		"effective_from": "2026-10",
		"rollover":       false,
	}, http.StatusCreated, &budget)
	source.MustDo(
		http.MethodPost,
		"/api/v1/budgets/"+budget.ID+"/end",
		map[string]any{"month": "2026-11"},
		http.StatusOK,
		nil,
	)

	target := apitest.New(t, apitest.Today("2026-10-26"))

	if r := target.Upload(importPath, "a.zip", export(t, source)); r.Status != http.StatusOK {
		t.Fatalf("import = %d: %s", r.Status, r.Body)
	}

	var list struct {
		Items []struct {
			Amounts []struct {
				EffectiveFrom string `json:"effective_from"`
				Ended         bool   `json:"ended"`
			} `json:"amounts"`
		} `json:"items"`
	}
	target.MustDo(http.MethodGet, "/api/v1/budgets", nil, http.StatusOK, &list)

	if len(list.Items) != 1 || len(list.Items[0].Amounts) != 2 ||
		list.Items[0].Amounts[1].EffectiveFrom != "2026-11" || !list.Items[0].Amounts[1].Ended {
		t.Fatalf("imported budgets = %+v, want the end from 2026-11", list.Items)
	}
}
