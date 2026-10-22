package classification_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type ruleView struct {
	ID             string           `json:"id"`
	Name           string           `json:"name"`
	Priority       int              `json:"priority"`
	Enabled        bool             `json:"enabled"`
	StopProcessing bool             `json:"stop_processing"`
	Conditions     []map[string]any `json:"conditions"`
	Actions        []map[string]any `json:"actions"`
}

func contains(text string) map[string]any {
	return map[string]any{"field": "description", "operator": "contains", "value": text}
}

func setCategory(category string) map[string]any {
	return map[string]any{"type": "set_category", "category_id": category}
}

func createRule(t *testing.T, h *apitest.Harness, name string, conditions, actions []map[string]any) ruleView {
	t.Helper()
	var out ruleView
	r := h.Do(http.MethodPost, "/api/v1/rules", map[string]any{"name": name, "conditions": conditions, "actions": actions})
	if r.Status != http.StatusCreated {
		t.Fatalf("create rule: status %d: %s", r.Status, r.Body)
	}
	r.Decode(t, &out)
	if loc := r.Header.Get("Location"); loc != "/api/v1/rules/"+out.ID {
		t.Fatalf("Location = %q", loc)
	}
	return out
}

func rulePriorities(t *testing.T, h *apitest.Harness) []string {
	t.Helper()
	var out struct {
		Items []ruleView `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/rules", nil, http.StatusOK, &out)
	names := make([]string, len(out.Items))
	for i, r := range out.Items {
		names[i] = r.Name
	}
	return names
}

func TestRuleLifecycle(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	transport := h.Account("Transport", "expense", "", nil)
	groceries := h.Account("Groceries", "expense", "", nil)
	cleaning := h.Account("Cleaning", "expense", "", nil)

	uber := createRule(t, h, "Uber", []map[string]any{contains("uber")}, []map[string]any{setCategory(transport)})
	if uber.Priority != 1 || !uber.Enabled || uber.StopProcessing || uber.Conditions[0]["value"] != "uber" || uber.Actions[0]["category_id"] != transport {
		t.Fatalf("rule = %+v", uber)
	}
	split := createRule(t, h, "Market", []map[string]any{
		{"field": "amount", "operator": "between", "value": []any{apitest.BRL(-50000), apitest.BRL(-100)}},
		{"field": "weekday", "operator": "in_list", "value": []any{"saturday", "sunday"}},
	}, []map[string]any{{"type": "split", "parts": []any{
		map[string]any{"category_id": groceries, "percent": 8000},
		map[string]any{"category_id": cleaning, "remainder": true},
	}}, {"type": "add_tags", "tags": []any{"home"}}})
	if split.Priority != 2 {
		t.Fatalf("second rule priority = %d", split.Priority)
	}
	var got ruleView
	h.MustDo(http.MethodGet, "/api/v1/rules/"+split.ID, nil, http.StatusOK, &got)
	between := got.Conditions[0]["value"].([]any)
	if len(between) != 2 || between[0].(map[string]any)["amount"] != float64(-50000) || got.Actions[1]["tags"].([]any)[0] != "home" {
		t.Fatalf("stored rule = %+v", got)
	}

	h.MustDo(http.MethodPut, "/api/v1/rules/"+uber.ID, map[string]any{
		"name": "Uber rides", "enabled": false, "stop_processing": true,
		"conditions": []any{contains("uber *trip")}, "actions": []any{setCategory(transport)},
	}, http.StatusOK, &got)
	if got.Name != "Uber rides" || got.Priority != 1 || got.Enabled || !got.StopProcessing {
		t.Fatalf("changed rule = %+v", got)
	}

	h.MustDo(http.MethodPost, "/api/v1/rules/reorder", map[string]any{"rule_ids": []string{split.ID, uber.ID}}, http.StatusOK, nil)
	if names := rulePriorities(t, h); !slices.Equal(names, []string{"Market", "Uber rides"}) {
		t.Fatalf("order = %v", names)
	}
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/rules/reorder", map[string]any{"rule_ids": []string{split.ID}}), http.StatusUnprocessableEntity, "validation_failed", "rule_ids")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/rules/reorder", map[string]any{"rule_ids": []string{split.ID, split.ID}}), http.StatusUnprocessableEntity, "validation_failed", "rule_ids")

	h.MustDo(http.MethodDelete, "/api/v1/rules/"+split.ID, nil, http.StatusNoContent, nil)
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/rules/"+split.ID, nil), http.StatusNotFound, "not_found", "")
	if third := createRule(t, h, "Third", []map[string]any{contains("x")}, []map[string]any{setCategory(transport)}); third.Priority != 3 {
		t.Fatalf("priority after delete = %d", third.Priority)
	}
}

func TestRuleTagsInAnyScript(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	rule := createRule(t, h, "Café", []map[string]any{contains("cafe")}, []map[string]any{{"type": "add_tags", "tags": []any{"café", "праздник"}}})
	if tags := rule.Actions[0]["tags"].([]any); len(tags) != 2 || tags[0] != "café" || tags[1] != "праздник" {
		t.Fatalf("tags = %v", tags)
	}
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/rules", map[string]any{"name": "r", "conditions": []any{contains("x")}, "actions": []any{map[string]any{"type": "add_tags", "tags": []any{"Café"}}}}),
		http.StatusBadRequest, "invalid_request", "actions[0].tags[0]")
}

func TestRuleRejections(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	transport := h.Account("Transport", "expense", "", nil)
	checking := h.Account("Nubank", "asset", "checking", nil)
	unknown := "00000000-0000-7000-8000-000000000000"
	tests := []struct {
		name       string
		conditions []map[string]any
		actions    []map[string]any
		field      string
	}{
		{"invalid regex", []map[string]any{{"field": "description", "operator": "regex", "value": "("}}, []map[string]any{setCategory(transport)}, "conditions[0].value"},
		{"between with min above max", []map[string]any{{"field": "amount", "operator": "between", "value": []any{apitest.BRL(10), apitest.BRL(5)}}}, []map[string]any{setCategory(transport)}, "conditions[0].value"},
		{"split without remainder", []map[string]any{contains("x")}, []map[string]any{{"type": "split", "parts": []any{
			map[string]any{"category_id": transport, "percent": 5000}, map[string]any{"category_id": transport, "percent": 4000},
		}}}, "actions[0].parts"},
		{"category of class asset", []map[string]any{contains("x")}, []map[string]any{setCategory(checking)}, "actions[0].category_id"},
		{"account condition on a category", []map[string]any{{"field": "account", "operator": "equals", "value": transport}}, []map[string]any{setCategory(transport)}, "conditions[0].value"},
		{"unknown payee", []map[string]any{contains("x")}, []map[string]any{{"type": "set_payee", "payee_id": unknown}}, "actions[0].payee_id"},
		{"unknown payee in a condition", []map[string]any{{"field": "payee", "operator": "equals", "value": unknown}}, []map[string]any{setCategory(transport)}, "conditions[0].value"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/rules", map[string]any{"name": "r", "conditions": tt.conditions, "actions": tt.actions}),
				http.StatusUnprocessableEntity, "validation_failed", tt.field)
		})
	}
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/rules", map[string]any{"name": "r", "conditions": []any{map[string]any{"field": "colour", "operator": "equals", "value": "x"}}, "actions": []any{setCategory(transport)}}),
		http.StatusBadRequest, "invalid_request", "conditions[0].field")
}

func TestAnotherUsersRuleIsNotFound(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	transport := h.Account("Transport", "expense", "", nil)
	rule := createRule(t, h, "Uber", []map[string]any{contains("uber")}, []map[string]any{setCategory(transport)})
	other := h.Login("other@example.com")
	for _, method := range []string{http.MethodGet, http.MethodDelete} {
		h.ExpectProblem(h.Call(other, method, "/api/v1/rules/"+rule.ID, nil), http.StatusNotFound, "not_found", "")
	}
}
