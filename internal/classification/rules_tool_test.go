package classification_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func toolOutput(t *testing.T, h *apitest.Harness, name string, args map[string]any, out any) {
	t.Helper()
	r := h.Tool(name, args)
	if r.IsError {
		t.Fatalf("%s = error %s", name, r.Content)
	}
	if err := json.Unmarshal(r.Content, out); err != nil {
		t.Fatal(err)
	}
}

func previewTool(t *testing.T, h *apitest.Harness, name string, args map[string]any) (tool.Preview, tool.Result) {
	t.Helper()
	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}
	p, r, err := h.App.Tools.Preview(auth.WithUserID(t.Context(), h.OwnerID()), name, b)
	if err != nil {
		t.Fatalf("preview %s: %v", name, err)
	}
	return p, r
}

type toolRule struct {
	RuleID           string `json:"rule_id"`
	Name             string `json:"name"`
	Priority         int    `json:"priority"`
	Enabled          bool   `json:"enabled"`
	ConditionsText   string `json:"conditions_text"`
	ActionsText      string `json:"actions_text"`
	CategorizedCount int    `json:"categorized_count"`
}

func TestManageRuleToolCreateAndRun(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	restaurant := b.h.Account("Restaurant", "expense", "", nil)
	first := b.record(t, "2026-10-10", "IFOOD *Loja", "", b.uncategorized, 1000)
	second := b.record(t, "2026-10-11", "IFOOD *Loja", "", b.uncategorized, 2000)
	dispatch(t, b.h)

	args := map[string]any{"action": "create_rule", "name": "iFood", "description_contains": "ifood", "category_id": restaurant}
	p, r := previewTool(t, b.h, "manage_rule", args)
	if r.IsError || p.Target != "Rule iFood" || p.Destructive || len(p.Changes) != 4 || p.Changes[2].Field != "category" || p.Changes[2].After.Text != "Restaurant" ||
		p.Changes[3].Field != "count" || p.Changes[3].After.Text != "2 transactions of the last year" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}
	var none struct {
		Rules []toolRule `json:"rules"`
	}
	toolOutput(t, b.h, "list_rules", map[string]any{"kind": "rules"}, &none)
	if len(none.Rules) != 0 {
		t.Fatalf("preview wrote %+v", none.Rules)
	}
	var created manageOut
	toolOutput(t, b.h, "manage_rule", args, &created)

	run := map[string]any{"action": "run_rules"}
	p, _ = previewTool(t, b.h, "manage_rule", run)
	if len(p.Changes) != 1 || p.Changes[0].After.Text != "2 uncategorized transactions" {
		t.Fatalf("run preview = %+v", p)
	}
	var out manageOut
	toolOutput(t, b.h, "manage_rule", run, &out)
	if out.Examined != 2 || out.Categorized != 2 {
		t.Fatalf("run = %+v", out)
	}
	dispatch(t, b.h)
	for _, tx := range []string{first, second} {
		if _, postings := categoryOf(t, b.h, tx); postings[restaurant] == 0 {
			t.Errorf("transaction %s postings = %v", tx, postings)
		}
	}

	var list struct {
		Rules []toolRule `json:"rules"`
	}
	toolOutput(t, b.h, "list_rules", map[string]any{"kind": "rules", "rule_id": created.RuleID}, &list)
	want := toolRule{RuleID: created.RuleID, Name: "iFood", Priority: 1, Enabled: true, ConditionsText: `description contains "ifood"`, ActionsText: "set category Restaurant", CategorizedCount: 2}
	if len(list.Rules) != 1 || list.Rules[0] != want {
		t.Errorf("rules = %+v, want %+v", list.Rules, want)
	}

	var expl struct {
		Items []struct {
			TransactionID string `json:"transaction_id"`
			Method        string `json:"method"`
			RuleName      string `json:"rule_name"`
		} `json:"items"`
	}
	toolOutput(t, b.h, "explain_categorization", map[string]any{"view": "transactions", "transaction_ids": []string{first}}, &expl)
	if len(expl.Items) != 1 || expl.Items[0].TransactionID != first || expl.Items[0].Method != "rule" || expl.Items[0].RuleName != "iFood" {
		t.Errorf("explanation = %+v", expl.Items)
	}
	var stats struct {
		Statistics struct{ Total, Rule, Uncategorized int } `json:"statistics"`
	}
	toolOutput(t, b.h, "explain_categorization", map[string]any{"view": "statistics", "from": "2026-10-01", "to": "2026-10-31"}, &stats)
	if stats.Statistics.Total != 2 || stats.Statistics.Rule != 2 || stats.Statistics.Uncategorized != 0 {
		t.Errorf("statistics = %+v", stats)
	}
	var prev struct {
		RulePreview struct {
			DescriptionContains string `json:"description_contains"`
			WouldCategorize     int    `json:"would_categorize"`
			Conflicts           int    `json:"conflicts"`
		} `json:"rule_preview"`
	}
	toolOutput(t, b.h, "explain_categorization", map[string]any{"view": "rule_preview", "description_contains": "ifood", "category_id": restaurant}, &prev)
	if prev.RulePreview.DescriptionContains != "ifood" {
		t.Errorf("rule preview = %+v", prev)
	}
}

type manageOut struct {
	RuleID       string `json:"rule_id"`
	SuggestionID string `json:"suggestion_id"`
	AliasID      string `json:"alias_id"`
	Examined     int    `json:"examined"`
	Categorized  int    `json:"categorized"`
	Deleted      bool   `json:"deleted"`
}

func TestManageRuleToolChangeReorderDelete(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	a := createRule(t, b.h, "A", []map[string]any{contains("a")}, []map[string]any{setCategory(b.transport)})
	c := createRule(t, b.h, "B", []map[string]any{contains("b")}, []map[string]any{setCategory(b.transport)})
	p, _ := previewTool(t, b.h, "manage_rule", map[string]any{"action": "change_rule", "rule_id": a.ID, "name": "A2", "description_contains": "uber", "category_id": b.travel})
	if p.Changes[0].Before.Text != "A" || p.Changes[0].After.Text != "A2" || p.Changes[2].Before.Text != "set category Ride-hailing" || p.Changes[2].After.Text != "Travel" {
		t.Fatalf("change preview = %+v", p)
	}
	toolOutput(t, b.h, "manage_rule", map[string]any{"action": "change_rule", "rule_id": a.ID, "name": "A2", "description_contains": "uber", "category_id": b.travel}, &manageOut{})
	order := map[string]any{"action": "reorder_rules", "rule_ids": []string{c.ID, a.ID}}
	p, _ = previewTool(t, b.h, "manage_rule", order)
	if len(p.Changes) != 2 || p.Changes[0].After.Text != "B: 1" {
		t.Fatalf("reorder preview = %+v", p)
	}
	toolOutput(t, b.h, "manage_rule", order, &manageOut{})
	var list struct {
		Rules []toolRule `json:"rules"`
	}
	toolOutput(t, b.h, "list_rules", map[string]any{"kind": "rules"}, &list)
	if len(list.Rules) != 2 || list.Rules[0].Name != "B" || list.Rules[1].Name != "A2" || list.Rules[1].ConditionsText != `description contains "uber"` {
		t.Fatalf("rules = %+v", list.Rules)
	}
	b.h.ExpectToolError(b.h.Tool("manage_rule", map[string]any{"action": "reorder_rules", "rule_ids": []string{a.ID}}), "validation_failed", "rule_ids")
	del := map[string]any{"action": "delete_rule", "rule_id": a.ID}
	if p, _ = previewTool(t, b.h, "manage_rule", del); !p.Destructive {
		t.Fatalf("delete preview = %+v", p)
	}
	var out manageOut
	toolOutput(t, b.h, "manage_rule", del, &out)
	b.h.ExpectProblem(b.h.Do(http.MethodGet, "/api/v1/rules/"+a.ID, nil), http.StatusNotFound, "not_found", "")
	b.h.ExpectToolError(b.h.Tool("manage_rule", del), "not_found", "")
	b.h.ExpectToolError(b.h.Tool("manage_rule", map[string]any{"action": "create_rule", "name": "x", "description_contains": "x", "category_id": "00000000-0000-7000-8000-000000000000"}), "validation_failed", "")
}

func TestManageRuleToolSuggestion(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	bakery := b.h.Account("Bakery", "expense", "", nil)
	txs := b.importLines(t, "a.ofx", line("20261005", "-8.50", "p1", "PADARIA SÃO JOÃO"))
	b.categorize(t, txs["PADARIA SÃO JOÃO"].ID, 1, bakery, 850)
	dispatch(t, b.h)
	b.h.Import(b.checking, "ofx", "b.ofx", apitest.OFX("", line("20261006", "-9.00", "p2", "Padaria São João")))
	var unc struct {
		Items []importedView `json:"items"`
	}
	b.h.MustDo(http.MethodGet, "/api/v1/transactions?uncategorized=true", nil, http.StatusOK, &unc)
	b.categorize(t, unc.Items[0].ID, 1, bakery, 900)
	dispatch(t, b.h)

	var list struct {
		Suggestions []struct {
			SuggestionID   string `json:"suggestion_id"`
			ConditionsText string `json:"conditions_text"`
			ActionsText    string `json:"actions_text"`
		} `json:"suggestions"`
	}
	toolOutput(t, b.h, "list_rules", map[string]any{"kind": "suggestions"}, &list)
	if len(list.Suggestions) != 1 || list.Suggestions[0].ConditionsText != `raw description equals "padaria sao joao"` || list.Suggestions[0].ActionsText != "set category Bakery" {
		t.Fatalf("suggestions = %+v", list.Suggestions)
	}
	id := list.Suggestions[0].SuggestionID
	b.h.ExpectToolError(b.h.Tool("manage_rule", map[string]any{"action": "accept_suggestion", "suggestion_id": id}), "invalid_arguments", "name")
	accept := map[string]any{"action": "accept_suggestion", "suggestion_id": id, "name": "Bakery"}
	if p, r := previewTool(t, b.h, "manage_rule", accept); r.IsError || p.Changes[0].After.Text != "Bakery" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}
	var out manageOut
	toolOutput(t, b.h, "manage_rule", accept, &out)
	if out.RuleID == "" {
		t.Fatalf("accepted = %+v", out)
	}
	b.h.ExpectToolError(b.h.Tool("manage_rule", accept), "suggestion_closed", "")
	_, r := previewTool(t, b.h, "manage_rule", accept)
	b.h.ExpectToolError(r, "suggestion_closed", "")
}

func TestManageRuleToolAliases(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	var payee struct {
		ID string `json:"id"`
	}
	b.h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": "Uber"}, http.StatusCreated, &payee)
	create := map[string]any{"action": "create_alias", "pattern": "uber *trip", "match_type": "contains", "payee_id": payee.ID}
	p, _ := previewTool(t, b.h, "manage_rule", create)
	if p.Target != "Alias uber *trip" || p.Changes[2].After.Text != "Uber" {
		t.Fatalf("preview = %+v", p)
	}
	var out manageOut
	toolOutput(t, b.h, "manage_rule", create, &out)
	b.h.ExpectToolError(b.h.Tool("manage_rule", create), "validation_failed", "pattern")
	var list struct {
		PayeeAliases []struct {
			AliasID   string `json:"alias_id"`
			Pattern   string `json:"pattern"`
			MatchType string `json:"match_type"`
			PayeeName string `json:"payee_name"`
		} `json:"payee_aliases"`
	}
	toolOutput(t, b.h, "list_rules", map[string]any{"kind": "payee_aliases"}, &list)
	if len(list.PayeeAliases) != 1 || list.PayeeAliases[0].AliasID != out.AliasID || list.PayeeAliases[0].PayeeName != "Uber" || list.PayeeAliases[0].MatchType != "contains" {
		t.Fatalf("aliases = %+v", list.PayeeAliases)
	}
	del := map[string]any{"action": "delete_alias", "alias_id": out.AliasID}
	if p, _ = previewTool(t, b.h, "manage_rule", del); !p.Destructive || p.Changes[0].Before.Text != "uber *trip" {
		t.Fatalf("delete preview = %+v", p)
	}
	toolOutput(t, b.h, "manage_rule", del, &manageOut{})
	toolOutput(t, b.h, "list_rules", map[string]any{"kind": "payee_aliases"}, &list)
	if len(list.PayeeAliases) != 0 {
		t.Fatalf("aliases after delete = %+v", list.PayeeAliases)
	}
}

func TestRulesToolsInvalidArguments(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	for _, tc := range []struct {
		tool  string
		args  map[string]any
		field string
	}{
		{"manage_rule", map[string]any{"action": "delete_rule"}, "rule_id"},
		{"manage_rule", map[string]any{"action": "delete_rule", "rule_id": "nope"}, "rule_id"},
		{"manage_rule", map[string]any{"action": "run_rules", "name": "x"}, "name"},
		{"manage_rule", map[string]any{"action": "create_alias", "pattern": "x", "payee_id": "00000000-0000-7000-8000-000000000000"}, "match_type"},
		{"list_rules", map[string]any{"kind": "suggestions", "rule_id": "00000000-0000-7000-8000-000000000000"}, "rule_id"},
		{"explain_categorization", map[string]any{"view": "statistics", "from": "2026-10-01"}, "to"},
		{"explain_categorization", map[string]any{"view": "rule_preview", "description_contains": "x"}, "category_id"},
		{"explain_categorization", map[string]any{"view": "transactions", "transaction_ids": strings.Split(strings.Repeat("x,", 51), ",")}, "transaction_ids"},
	} {
		h.ExpectToolError(h.Tool(tc.tool, tc.args), "invalid_arguments", tc.field)
	}
}

func TestRulesToolsOtherUser(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	other := h.LoginAs("other@example.com", locale.Locale{Language: "pt", Region: "BR"}, "BRL")
	var category, rule struct {
		ID string `json:"id"`
	}
	h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Theirs", "class": "expense", "currency": "BRL"}).Decode(t, &category)
	r := h.Call(other, http.MethodPost, "/api/v1/rules", map[string]any{"name": "Theirs", "conditions": []any{contains("x")}, "actions": []any{setCategory(category.ID)}})
	r.Decode(t, &rule)
	if r.Status != http.StatusCreated {
		t.Fatalf("create rule status %d: %s", r.Status, r.Body)
	}
	h.ExpectToolError(h.Tool("list_rules", map[string]any{"kind": "rules", "rule_id": rule.ID}), "not_found", "")
	for _, action := range []map[string]any{
		{"action": "delete_rule", "rule_id": rule.ID},
		{"action": "change_rule", "rule_id": rule.ID, "name": "x", "description_contains": "x", "category_id": category.ID},
	} {
		h.ExpectToolError(h.Tool("manage_rule", action), "not_found", "")
		_, res := previewTool(t, h, "manage_rule", action)
		h.ExpectToolError(res, "not_found", "")
	}
}
