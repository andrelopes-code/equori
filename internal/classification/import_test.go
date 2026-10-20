package classification_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type importedView struct {
	ID          string   `json:"id"`
	Version     int      `json:"version"`
	Description string   `json:"description"`
	PayeeID     string   `json:"payee_id"`
	Tags        []string `json:"tags"`
	Postings    []struct {
		AccountID string `json:"account_id"`
		Amount    struct {
			Amount int64 `json:"amount"`
		} `json:"amount"`
	} `json:"postings"`
}

func (v importedView) amounts() map[string]int64 {
	m := map[string]int64{}
	for _, p := range v.Postings {
		m[p.AccountID] += p.Amount.Amount
	}
	return m
}

// importLines imports an OFX file into checking and returns the created transactions by description.
func (b books) importLines(t *testing.T, name string, lines ...apitest.OFXLine) map[string]importedView {
	t.Helper()
	if r := b.h.Import(b.checking, "ofx", name, apitest.OFX("", lines...)); r.Status != http.StatusCreated {
		t.Fatalf("import status %d: %s", r.Status, r.Body)
	}
	var list struct {
		Items []importedView `json:"items"`
	}
	b.h.MustDo(http.MethodGet, "/api/v1/transactions?account_id="+b.checking+"&limit=200", nil, http.StatusOK, &list)
	out := map[string]importedView{}
	for _, v := range list.Items {
		out[v.Description] = v
	}
	return out
}

func line(date, amount, fitid, name string) apitest.OFXLine {
	return apitest.OFXLine{Date: date, Amount: amount, FITID: fitid, Name: name}
}

// S37: a rule categorizes an imported line before it is recorded (P5 amendment A19).
func TestImportAppliesRule(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	rule := createRule(t, b.h, "Uber", []map[string]any{contains("uber")}, []map[string]any{setCategory(b.transport)})
	tx := b.importLines(t, "s37.ofx", line("20261014", "-23.90", "s37", "UBER *TRIP"))["UBER *TRIP"]
	if got := tx.amounts(); tx.Version != 1 || len(tx.Postings) != 2 || got[b.transport] != 2390 || got[b.checking] != -2390 {
		t.Fatalf("transaction = %+v", tx)
	}
	dispatch(t, b.h)
	if c := categorizationOf(t, b.h, tx.ID); method(c) != "rule" || c.RuleID != rule.ID {
		t.Fatalf("categorization = %+v", c)
	}
}

// S38: an alias names the payee and the payee's history gives the category (A22, A23).
func TestImportAppliesAliasAndHistory(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	ifood := payee(t, b.h, "iFood")
	b.h.MustDo(http.MethodPost, "/api/v1/payee-aliases", map[string]any{"pattern": "ifd*", "match_type": "starts_with", "payee_id": ifood}, http.StatusCreated, nil)
	b.record(t, "2026-10-01", "iFood", ifood, b.delivery, 3000)

	tx := b.importLines(t, "s38.ofx", line("20261010", "-45.00", "s38", "IFD*IFOOD SAO PAULO"))["IFD*IFOOD SAO PAULO"]
	if got := tx.amounts(); tx.PayeeID != ifood || got[b.delivery] != 4500 || tx.Version != 1 {
		t.Fatalf("transaction = %+v", tx)
	}
	dispatch(t, b.h)
	if c := categorizationOf(t, b.h, tx.ID); method(c) != "history" || c.RuleID != "" {
		t.Fatalf("categorization = %+v", c)
	}
}

// S39: the first rule decides the category, tags accumulate, stop_processing ends evaluation (A21).
func TestImportMergesRules(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	fuel := b.h.Account("Fuel", "expense", "", nil)
	posto := createRule(t, b.h, "Posto", []map[string]any{contains("posto")}, []map[string]any{setCategory(fuel)})
	createRule(t, b.h, "Shell", []map[string]any{contains("shell")}, []map[string]any{setCategory(b.travel), {"type": "add_tags", "tags": []any{"car"}}})

	first := b.importLines(t, "s39a.ofx", line("20261012", "-150.00", "s39a", "POSTO SHELL"))["POSTO SHELL"]
	if got := first.amounts(); got[fuel] != 15000 || !slices.Equal(first.Tags, []string{"car"}) {
		t.Fatalf("first = %+v", first)
	}
	b.h.MustDo(http.MethodPut, "/api/v1/rules/"+posto.ID, map[string]any{
		"name": "Posto", "stop_processing": true, "conditions": []any{contains("posto")}, "actions": []any{setCategory(fuel)},
	}, http.StatusOK, nil)
	second := b.importLines(t, "s39b.ofx", line("20261013", "-80.00", "s39b", "POSTO SHELL 2"))["POSTO SHELL 2"]
	if got := second.amounts(); got[fuel] != 8000 || len(second.Tags) != 0 {
		t.Fatalf("second = %+v", second)
	}
}

// S40: a percent split rounds toward zero and the remainder takes the rest (A21).
func TestImportSplitsByRule(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	groceries := b.h.Account("Groceries", "expense", "", nil)
	cleaning := b.h.Account("Cleaning", "expense", "", nil)
	market := payee(t, b.h, "Pão de Açúcar")
	b.h.MustDo(http.MethodPost, "/api/v1/payee-aliases", map[string]any{"pattern": "pao de acucar", "match_type": "contains", "payee_id": market}, http.StatusCreated, nil)
	createRule(t, b.h, "Market", []map[string]any{{"field": "payee", "operator": "equals", "value": market}}, []map[string]any{{"type": "split", "parts": []any{
		map[string]any{"category_id": groceries, "percent": 8000}, map[string]any{"category_id": cleaning, "remainder": true},
	}}})

	tx := b.importLines(t, "s40.ofx", line("20261011", "-99.99", "s40", "PÃO DE AÇÚCAR 123"))["PÃO DE AÇÚCAR 123"]
	if got := tx.amounts(); tx.PayeeID != market || len(tx.Postings) != 3 || got[groceries] != 7999 || got[cleaning] != 2000 {
		t.Fatalf("transaction = %+v", tx)
	}
}

// P5 Review Focus 3: a rule whose category closed after the rule was created is skipped.
func TestImportSkipsRuleWithClosedCategory(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	old := b.h.Account("Old bakery", "expense", "", nil)
	createRule(t, b.h, "Bakery", []map[string]any{contains("padaria")}, []map[string]any{setCategory(old)})
	createRule(t, b.h, "Nothing", []map[string]any{{"field": "description", "operator": "regex", "value": `^ZZZ\d{9}$`}}, []map[string]any{setCategory(b.food)})
	b.h.MustDo(http.MethodPost, "/api/v1/accounts/"+old+"/close", map[string]any{"closed_on": "2026-09-30"}, http.StatusOK, nil)

	tx := b.importLines(t, "rf3.ofx", line("20261010", "-8.50", "rf3", "PADARIA"))["PADARIA"]
	if got := tx.amounts(); got[b.uncategorized] != 850 || got[old] != 0 {
		t.Fatalf("transaction = %+v", tx)
	}
}

// S73: a rule naming an archived category does not decide; after reopening, running rules does (A74).
func TestArchivedCategoryStopsRuleUntilReopened(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	bakery := b.h.Account("Bakery", "expense", "", nil)
	rule := createRule(t, b.h, "Bakery", []map[string]any{contains("padaria")}, []map[string]any{setCategory(bakery)})
	b.h.MustDo(http.MethodPost, "/api/v1/accounts/"+bakery+"/close", map[string]any{"closed_on": "2026-10-31"}, http.StatusOK, nil)

	tx := b.importLines(t, "s73.ofx", line("20261102", "-8.50", "s73", "PADARIA SAO JOAO"))["PADARIA SAO JOAO"]
	if got := tx.amounts(); got[b.uncategorized] != 850 || got[bakery] != 0 {
		t.Fatalf("imported while archived = %+v", tx)
	}
	dispatch(t, b.h)

	b.h.MustDo(http.MethodPost, "/api/v1/accounts/"+bakery+"/reopen", nil, http.StatusOK, nil)
	var run struct {
		Examined    int `json:"examined"`
		Categorized int `json:"categorized"`
	}
	b.h.MustDo(http.MethodPost, "/api/v1/rules/run", nil, http.StatusOK, &run)
	if run.Examined != 1 || run.Categorized != 1 {
		t.Fatalf("run = %+v", run)
	}
	dispatch(t, b.h)
	if _, postings := categoryOf(t, b.h, tx.ID); postings[bakery] != 850 {
		t.Fatalf("postings after reopen = %v", postings)
	}
	if c := categorizationOf(t, b.h, tx.ID); method(c) != "rule" || c.RuleID != rule.ID {
		t.Fatalf("categorization = %+v", c)
	}
}

// S44: SC5 over imports, history, a manual change and an uncategorized line.
func TestStatisticsAfterImports(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	ifood := payee(t, b.h, "iFood")
	b.h.MustDo(http.MethodPost, "/api/v1/payee-aliases", map[string]any{"pattern": "ifd*", "match_type": "starts_with", "payee_id": ifood}, http.StatusCreated, nil)
	b.record(t, "2026-10-01", "iFood", ifood, b.delivery, 3000)
	b.importLines(t, "early.ofx", line("20261015", "-31.00", "e1", "UBER *EATS"))
	createRule(t, b.h, "Uber", []map[string]any{contains("uber")}, []map[string]any{setCategory(b.transport)})
	txs := b.importLines(t, "s44.ofx",
		line("20261014", "-23.90", "s37", "UBER *TRIP"),
		line("20261010", "-45.00", "s38", "IFD*IFOOD SAO PAULO"),
		line("20261020", "-12.00", "u1", "FARMACIA"))
	b.categorize(t, txs["UBER *TRIP"].ID, 1, b.travel, 2390)
	dispatch(t, b.h)
	b.h.MustDo(http.MethodPost, "/api/v1/rules/run", nil, http.StatusOK, nil)
	dispatch(t, b.h)

	var st map[string]any
	b.h.MustDo(http.MethodGet, "/api/v1/categorization-statistics?from=2026-10-01&to=2026-10-31", nil, http.StatusOK, &st)
	want := map[string]any{"total": float64(5), "rule": float64(1), "history": float64(1), "manual": float64(2), "source": float64(0), "uncategorized": float64(1)}
	for k, v := range want {
		if st[k] != v {
			t.Fatalf("statistics = %v, want %v", st, want)
		}
	}
}
