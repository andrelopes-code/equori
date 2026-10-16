package classification_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type suggestionView struct {
	ID         string           `json:"id"`
	State      string           `json:"state"`
	RuleID     string           `json:"rule_id"`
	Examples   []string         `json:"example_transaction_ids"`
	Conditions []map[string]any `json:"conditions"`
	Actions    []map[string]any `json:"actions"`
}

func suggestions(t *testing.T, h *apitest.Harness, state string) []suggestionView {
	t.Helper()
	var out struct {
		Items []suggestionView `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/rule-suggestions?state="+state, nil, http.StatusOK, &out)
	return out.Items
}

// S42: two equal corrections suggest a rule; accepting it categorizes the next import (A24).
func TestSuggestionFromRepeatedCorrections(t *testing.T) {
	b := newBooks(t)
	bakery := b.h.Account("Bakery", "expense", "", nil)
	createRule(t, b.h, "Uber", []map[string]any{contains("uber")}, []map[string]any{setCategory(b.transport)})
	txs := b.importLines(t, "s42a.ofx", line("20261005", "-8.50", "p1", "PADARIA SÃO JOÃO"))
	first := txs["PADARIA SÃO JOÃO"].ID
	b.categorize(t, first, 1, bakery, 850)
	dispatch(t, b.h)
	if got := suggestions(t, b.h, "pending"); len(got) != 0 {
		t.Fatalf("one correction suggested %+v", got)
	}

	if r := b.h.Import(b.checking, "ofx", "s42b.ofx", apitest.OFX("", line("20261006", "-9.00", "p2", "Padaria São João"))); r.Status != http.StatusCreated {
		t.Fatalf("import status %d: %s", r.Status, r.Body)
	}
	var list struct {
		Items []importedView `json:"items"`
	}
	b.h.MustDo(http.MethodGet, "/api/v1/transactions?uncategorized=true", nil, http.StatusOK, &list)
	if len(list.Items) != 1 {
		t.Fatalf("uncategorized = %+v", list.Items)
	}
	second := list.Items[0].ID
	b.categorize(t, second, 1, bakery, 900)
	dispatch(t, b.h)

	pending := suggestions(t, b.h, "pending")
	if len(pending) != 1 {
		t.Fatalf("pending = %+v", pending)
	}
	s := pending[0]
	if !slices.Equal(s.Examples, []string{first, second}) || len(s.Conditions) != 1 || s.Conditions[0]["field"] != "raw_description" ||
		s.Conditions[0]["operator"] != "equals" || s.Conditions[0]["value"] != "padaria sao joao" || s.Actions[0]["category_id"] != bakery {
		t.Fatalf("suggestion = %+v", s)
	}

	var accepted suggestionView
	b.h.MustDo(http.MethodPost, "/api/v1/rule-suggestions/"+s.ID+"/accept", map[string]string{"name": "Bakery"}, http.StatusOK, &accepted)
	if accepted.State != "accepted" || accepted.RuleID == "" {
		t.Fatalf("accepted = %+v", accepted)
	}
	var rule ruleView
	b.h.MustDo(http.MethodGet, "/api/v1/rules/"+accepted.RuleID, nil, http.StatusOK, &rule)
	if rule.Name != "Bakery" || rule.Priority != 2 || !rule.Enabled {
		t.Fatalf("rule = %+v", rule)
	}

	third := b.importLines(t, "s42c.ofx", line("20261007", "-7.00", "p3", "PADARIA SAO JOAO"))["PADARIA SAO JOAO"]
	if got := third.amounts(); got[bakery] != 700 {
		t.Fatalf("third = %+v", third)
	}
	dispatch(t, b.h)
	if c := categorizationOf(t, b.h, third.ID); method(c) != "rule" || c.RuleID != rule.ID {
		t.Fatalf("third categorization = %+v", c)
	}

	b.h.ExpectProblem(b.h.Do(http.MethodPost, "/api/v1/rule-suggestions/"+s.ID+"/accept", map[string]string{"name": "Again"}), http.StatusConflict, "suggestion_closed", "")
	b.h.ExpectProblem(b.h.Do(http.MethodPost, "/api/v1/rule-suggestions/"+s.ID+"/dismiss", nil), http.StatusConflict, "suggestion_closed", "")
}

func TestSuggestionExamplesAndDismissal(t *testing.T) {
	b := newBooks(t)
	var pharmacy []string
	for _, date := range []string{"2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"} {
		pharmacy = append(pharmacy, b.record(t, date, "FARMÁCIA", "", b.uncategorized, 1000))
	}
	market := []string{b.record(t, "2026-10-05", "MERCADO", "", b.uncategorized, 1000), b.record(t, "2026-10-06", "MERCADO", "", b.uncategorized, 1000)}
	dispatch(t, b.h)

	for _, tx := range market {
		b.h.MustDo(http.MethodPost, "/api/v1/transactions/"+tx+"/categorize", map[string]any{"expected_version": 1, "parts": []any{
			map[string]any{"account_id": b.food, "amount": apitest.BRL(600)}, map[string]any{"account_id": b.delivery, "amount": apitest.BRL(400)},
		}}, http.StatusOK, nil)
	}
	for _, tx := range pharmacy[:3] {
		b.categorize(t, tx, 1, b.food, 1000)
	}
	dispatch(t, b.h)

	pending := suggestions(t, b.h, "pending")
	if len(pending) != 1 || !slices.Equal(pending[0].Examples, pharmacy[:3]) {
		t.Fatalf("pending = %+v", pending)
	}
	var dismissed suggestionView
	b.h.MustDo(http.MethodPost, "/api/v1/rule-suggestions/"+pending[0].ID+"/dismiss", nil, http.StatusOK, &dismissed)
	if dismissed.State != "dismissed" || dismissed.RuleID != "" {
		t.Fatalf("dismissed = %+v", dismissed)
	}

	b.categorize(t, pharmacy[3], 1, b.food, 1000)
	dispatch(t, b.h)
	if got := suggestions(t, b.h, "pending"); len(got) != 0 {
		t.Fatalf("pending after dismissal = %+v", got)
	}
	if got := suggestions(t, b.h, "dismissed"); len(got) != 1 || len(got[0].Examples) != 3 {
		t.Fatalf("dismissed = %+v", got)
	}
}
