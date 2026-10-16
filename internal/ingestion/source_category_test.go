package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/pluggy"
)

type sourceCategoryView struct {
	ID         string `json:"id"`
	Provider   string `json:"provider"`
	ExternalID string `json:"external_id"`
	Name       string `json:"name"`
	Count      int    `json:"count"`
	CategoryID string `json:"category_id"`
}

func categorizedLine(id, date, description string) pluggy.Transaction {
	t := bankLine(id, date, "-45.90")
	t.Description = description
	t.CategoryID, t.Category = new("05010000"), new("Food Delivery")
	return t
}

func (f syncFixture) sourceCategories(c *http.Client) []sourceCategoryView {
	f.h.T().Helper()
	var out struct {
		Items []sourceCategoryView `json:"items"`
	}
	r := f.h.Call(c, http.MethodGet, "/api/v1/source-categories", nil)
	if r.Status != http.StatusOK {
		f.h.T().Fatalf("source categories status %d: %s", r.Status, r.Body)
	}
	r.Decode(f.h.T(), &out)
	return out.Items
}

// categoryOf returns the category account of an imported line's transaction.
func (f syncFixture) categoryOf(externalID string) string {
	f.h.T().Helper()
	_, tx := f.recordOf(externalID)
	for _, p := range f.h.Transaction(tx).Postings {
		if p.AccountID != f.checking {
			return p.AccountID
		}
	}
	return ""
}

// S56: Pluggy category "Food Delivery" mapped to Food › Delivery categorizes a line that no
// rule matches, with method source (P6 amendment A41).
func TestSourceCategory(t *testing.T) {
	f := newSyncFixture(t)
	food := f.h.Account("Food", "expense", "", nil)
	delivery := f.h.Account("Delivery", "expense", "", map[string]any{"parent_id": food})
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.line(pluggy.SubtypeChecking, categorizedLine("tx-1", "2026-10-20", "RESTAURANTE A"))
	f.sync()

	got := f.sourceCategories(f.h.Client)
	want := sourceCategoryView{ID: got[0].ID, Provider: "pluggy", ExternalID: "05010000", Name: "Food Delivery", Count: 1}
	if len(got) != 1 || got[0] != want {
		t.Fatalf("source categories = %+v, want [%+v]", got, want)
	}
	sys := map[string]string{}
	var accounts struct {
		Items []struct {
			ID         string `json:"id"`
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &accounts)
	for _, a := range accounts.Items {
		sys[a.SystemRole] = a.ID
	}
	if c := f.categoryOf("tx-1"); c != sys["uncategorized_expense"] {
		t.Fatalf("unmapped line category = %s", c)
	}

	path := "/api/v1/source-categories/" + want.ID
	f.h.ExpectProblem(f.h.Do(http.MethodPut, path, map[string]any{"category_id": f.checking}), http.StatusUnprocessableEntity, "validation_failed", "category_id")
	f.h.ExpectProblem(f.h.Do(http.MethodPut, path, map[string]any{"category_id": uuid.NewString()}), http.StatusUnprocessableEntity, "validation_failed", "category_id")
	var mapped sourceCategoryView
	f.h.MustDo(http.MethodPut, path, map[string]any{"category_id": delivery}, http.StatusOK, &mapped)
	if want.CategoryID = delivery; mapped != want {
		t.Fatalf("mapped = %+v, want %+v", mapped, want)
	}

	f.line(pluggy.SubtypeChecking, categorizedLine("tx-2", "2026-10-21", "RESTAURANTE B"))
	f.mustSyncNow(f.conn.ID)
	if c := f.categoryOf("tx-2"); c != delivery {
		t.Fatalf("mapped line category = %s, want %s", c, delivery)
	}
	if got := f.sourceCategories(f.h.Client); got[0].Count != 2 {
		t.Fatalf("count = %d", got[0].Count)
	}

	// A rule still wins over a mapped source category (F5 precedence).
	f.h.MustDo(http.MethodPost, "/api/v1/rules", map[string]any{
		"name":       "iFood",
		"conditions": []map[string]any{{"field": "description", "operator": "contains", "value": "ifood"}},
		"actions":    []map[string]any{{"type": "set_category", "category_id": food}},
	}, http.StatusCreated, nil)
	f.line(pluggy.SubtypeChecking, categorizedLine("tx-3", "2026-10-22", "IFOOD *PEDIDO"))
	f.mustSyncNow(f.conn.ID)
	if c := f.categoryOf("tx-3"); c != food {
		t.Fatalf("rule line category = %s, want %s", c, food)
	}

	f.h.Dispatch()
	var stats struct {
		Rule   int `json:"rule"`
		Source int `json:"source"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/categorization-statistics?from=2026-10-01&to=2026-10-31", nil, http.StatusOK, &stats)
	if stats.Source != 1 || stats.Rule != 1 {
		t.Fatalf("statistics = %+v", stats)
	}

	other := f.h.Login("other@example.com")
	if got := f.sourceCategories(other); len(got) != 0 {
		t.Fatalf("other user sees %+v", got)
	}
	f.h.ExpectProblem(f.h.Call(other, http.MethodPut, path, map[string]any{"category_id": nil}), http.StatusNotFound, "not_found", "")
	var cleared sourceCategoryView
	f.h.MustDo(http.MethodPut, path, map[string]any{"category_id": nil}, http.StatusOK, &cleared)
	if cleared.CategoryID != "" || cleared.Count != 3 {
		t.Fatalf("cleared = %+v", cleared)
	}
}
