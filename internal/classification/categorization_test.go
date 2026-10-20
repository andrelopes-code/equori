package classification_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type categorizationView struct {
	TransactionID string  `json:"transaction_id"`
	Method        *string `json:"method"`
	RuleID        string  `json:"rule_id"`
	DecidedAt     string  `json:"decided_at"`
}

func categorizationOf(t *testing.T, h *apitest.Harness, tx string) categorizationView {
	t.Helper()
	var out categorizationView
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+tx+"/categorization", nil, http.StatusOK, &out)
	return out
}

func method(c categorizationView) string {
	if c.Method == nil {
		return "uncategorized"
	}
	return *c.Method
}

// dispatch delivers every pending event within 10 s; a handler that waits on its own
// database lock fails it (P5 Review Focus 1).
// dispatch delivers outbox events until none is pending; the bound on rounds, not a clock,
// stops a delivery that keeps publishing, so a slow machine never fails it.
func dispatch(t *testing.T, h *apitest.Harness) {
	t.Helper()
	for range 100 {
		n, err := h.App.Dispatcher.DispatchPending(t.Context())
		if err != nil {
			t.Fatalf("dispatch: %v", err)
		}
		if n == 0 {
			return
		}
	}
	t.Fatal("dispatch: events still pending after 100 rounds")
}

type books struct {
	h                                 *apitest.Harness
	checking, savings, uncategorized  string
	transport, travel, food, delivery string
}

func newBooks(t *testing.T) books {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	var accounts struct {
		Items []struct {
			ID         string `json:"id"`
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &accounts)
	b := books{h: h}
	for _, a := range accounts.Items {
		if a.SystemRole == "uncategorized_expense" {
			b.uncategorized = a.ID
		}
	}
	b.checking = h.Account("Nubank checking", "asset", "checking", nil)
	b.savings = h.Account("Savings", "asset", "savings", nil)
	b.transport = h.Account("Ride-hailing", "expense", "", nil)
	b.travel = h.Account("Travel", "expense", "", nil)
	b.food = h.Account("Food", "expense", "", nil)
	b.delivery = h.Account("Delivery", "expense", "", nil)
	return b
}

// record posts a manual transaction; category is the expense account, or b.uncategorized.
func (b books) record(t *testing.T, date, description, payee, category string, amount int64) string {
	t.Helper()
	body := map[string]any{"date": date, "description": description,
		"postings": []any{apitest.Posting(b.checking, -amount), apitest.Posting(category, amount)}}
	if payee != "" {
		body["payee_id"] = payee
	}
	var out struct {
		ID string `json:"id"`
	}
	b.h.MustDo(http.MethodPost, "/api/v1/transactions", body, http.StatusCreated, &out)
	return out.ID
}

func (b books) categorize(t *testing.T, tx string, version int, category string, amount int64) {
	t.Helper()
	b.h.MustDo(http.MethodPost, "/api/v1/transactions/"+tx+"/categorize", map[string]any{
		"expected_version": version, "parts": []any{map[string]any{"account_id": category, "amount": apitest.BRL(amount)}},
	}, http.StatusOK, nil)
}

func categoryOf(t *testing.T, h *apitest.Harness, tx string) (int, map[string]int64) {
	t.Helper()
	v := h.Transaction(tx)
	m := map[string]int64{}
	for _, p := range v.Postings {
		m[p.AccountID] += p.Amount.Amount
	}
	return v.Version, m
}

// F5 on a transaction recorded without category: a rule decides it after commit.
func TestNewTransactionIsClassifiedByRule(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	rule := createRule(t, b.h, "Uber", []map[string]any{contains("uber")}, []map[string]any{setCategory(b.transport)})
	tx := b.record(t, "2026-10-14", "UBER *TRIP", "", b.uncategorized, 2390)
	dispatch(t, b.h)

	version, postings := categoryOf(t, b.h, tx)
	if version != 2 || postings[b.transport] != 2390 || postings[b.uncategorized] != 0 {
		t.Fatalf("version %d, postings %v", version, postings)
	}
	if c := categorizationOf(t, b.h, tx); method(c) != "rule" || c.RuleID != rule.ID || c.TransactionID != tx {
		t.Fatalf("categorization = %+v", c)
	}
}

func TestOwnerCategorizationIsManual(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	tx := b.record(t, "2026-10-14", "PADARIA", "", b.uncategorized, 1000)
	dispatch(t, b.h)
	if c := categorizationOf(t, b.h, tx); method(c) != "uncategorized" || c.RuleID != "" {
		t.Fatalf("before = %+v", c)
	}

	b.categorize(t, tx, 1, b.food, 1000)
	dispatch(t, b.h)
	if c := categorizationOf(t, b.h, tx); method(c) != "manual" {
		t.Fatalf("after categorize = %+v", c)
	}

	b.h.MustDo(http.MethodPut, "/api/v1/transactions/"+tx, map[string]any{
		"date": "2026-10-14", "description": "Padaria São João", "expected_version": 2, "reason": "rename",
		"postings": []any{apitest.Posting(b.checking, -1000), apitest.Posting(b.food, 1000)},
	}, http.StatusOK, nil)
	dispatch(t, b.h)
	if c := categorizationOf(t, b.h, tx); method(c) != "manual" {
		t.Fatalf("after rename = %+v", c)
	}

	transfer := b.h.Record("2026-10-14", apitest.Posting(b.checking, -500), apitest.Posting(b.savings, 500))
	dispatch(t, b.h)
	b.h.ExpectProblem(b.h.Do(http.MethodGet, "/api/v1/transactions/"+transfer+"/categorization", nil), http.StatusNotFound, "not_found", "")
}

// Events of one transaction delivered out of order and twice (P5 Review Focus 2).
func TestCategorizationFollowsTheHighestVersion(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	tx := b.record(t, "2026-10-14", "PADARIA", "", b.uncategorized, 1000)
	b.categorize(t, tx, 1, b.food, 1000)
	exec := func(sql string) {
		t.Helper()
		if _, err := b.h.Pool.Exec(t.Context(), sql, tx); err != nil {
			t.Fatal(err)
		}
	}
	// The recorded event fails once and waits; the categorized event goes first.
	exec(`INSERT INTO outbox_delivery (event_id, consumer, status, attempts, next_attempt_at)
		SELECT id, 'classification', 'retrying', 1, now() + interval '1 hour' FROM outbox_event
		WHERE aggregate_id = $1 AND type = 'ledger.transaction_recorded.v1'`)
	dispatch(t, b.h)
	check := func(when string) {
		t.Helper()
		var version int
		err := b.h.Pool.QueryRow(t.Context(), `SELECT transaction_version FROM classification_categorization WHERE transaction_id = $1`, tx).Scan(&version)
		if c := categorizationOf(t, b.h, tx); method(c) != "manual" || err != nil || version != 2 {
			t.Fatalf("%s: categorization %+v, row version %d, %v", when, c, version, err)
		}
	}
	check("after the categorized event")

	exec(`UPDATE outbox_delivery SET next_attempt_at = now() - interval '1 second'
		WHERE consumer = 'classification' AND event_id IN (SELECT id FROM outbox_event WHERE aggregate_id = $1)`)
	dispatch(t, b.h)
	check("after the late recorded event")

	exec(`DELETE FROM outbox_delivery WHERE consumer = 'classification' AND event_id IN
		(SELECT id FROM outbox_event WHERE aggregate_id = $1 AND type = 'ledger.transaction_recorded.v1')`)
	dispatch(t, b.h)
	check("after the recorded event again")
}

// S41 and P5 Review Focus 4: running rules changes only uncategorized transactions.
func TestRunRules(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	batch := b.h.Import(b.checking, "ofx", "nubank.ofx", apitest.OFX("",
		apitest.OFXLine{Date: "20261014", Amount: "-23.90", FITID: "u1", Name: "UBER *TRIP"},
		apitest.OFXLine{Date: "20261015", Amount: "-31.00", FITID: "u2", Name: "UBER *EATS"}))
	if batch.Status != http.StatusCreated {
		t.Fatalf("import status %d: %s", batch.Status, batch.Body)
	}
	var list struct {
		Items []struct {
			ID          string `json:"id"`
			Description string `json:"description"`
		} `json:"items"`
	}
	b.h.MustDo(http.MethodGet, "/api/v1/transactions?uncategorized=true", nil, http.StatusOK, &list)
	ids := map[string]string{}
	for _, it := range list.Items {
		ids[it.Description] = it.ID
	}
	trip, eats := ids["UBER *TRIP"], ids["UBER *EATS"]
	if trip == "" || eats == "" {
		t.Fatalf("imported = %+v", list.Items)
	}
	b.categorize(t, trip, 1, b.travel, 2390)
	split := b.h.Record("2026-10-16", apitest.Posting(b.checking, -1000), apitest.Posting(b.food, 600), apitest.Posting(b.uncategorized, 400))
	dispatch(t, b.h)

	rule := createRule(t, b.h, "Uber", []map[string]any{contains("uber")}, []map[string]any{setCategory(b.transport)})
	var run struct {
		Examined    int `json:"examined"`
		Categorized int `json:"categorized"`
	}
	b.h.MustDo(http.MethodPost, "/api/v1/rules/run", nil, http.StatusOK, &run)
	if run.Examined != 1 || run.Categorized != 1 {
		t.Fatalf("run = %+v", run)
	}
	dispatch(t, b.h)

	if _, postings := categoryOf(t, b.h, eats); postings[b.transport] != 3100 {
		t.Fatalf("eats postings = %v", postings)
	}
	if c := categorizationOf(t, b.h, eats); method(c) != "rule" || c.RuleID != rule.ID {
		t.Fatalf("eats categorization = %+v", c)
	}
	if version, postings := categoryOf(t, b.h, trip); version != 2 || postings[b.travel] != 2390 {
		t.Fatalf("trip version %d, postings %v", version, postings)
	}
	if version, _ := categoryOf(t, b.h, split); version != 1 {
		t.Fatalf("owner split changed to version %d", version)
	}
	b.h.MustDo(http.MethodPost, "/api/v1/rules/run", nil, http.StatusOK, &run)
	if run.Examined != 0 || run.Categorized != 0 {
		t.Fatalf("second run = %+v", run)
	}
}

// SC5 over manual entries: rule, history, manual and uncategorized in one month.
func TestCategorizationStatistics(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	createRule(t, b.h, "Uber", []map[string]any{contains("uber")}, []map[string]any{setCategory(b.transport)})
	var ifood struct {
		ID string `json:"id"`
	}
	b.h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": "iFood"}, http.StatusCreated, &ifood)

	b.record(t, "2026-10-01", "iFood", ifood.ID, b.delivery, 4000)                 // manual
	history := b.record(t, "2026-10-02", "iFood", ifood.ID, b.uncategorized, 4500) // history
	b.record(t, "2026-10-03", "UBER *TRIP", "", b.uncategorized, 2390)             // rule
	b.record(t, "2026-10-04", "Farmácia", "", b.uncategorized, 1200)               // uncategorized
	corrected := b.record(t, "2026-10-05", "Padaria", "", b.uncategorized, 800)
	b.categorize(t, corrected, 1, b.food, 800) // manual
	voided := b.record(t, "2026-10-06", "Duplicate", "", b.food, 100)
	b.h.MustDo(http.MethodPost, "/api/v1/transactions/"+voided+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)
	b.record(t, "2026-09-30", "Before", "", b.food, 100)
	b.h.Record("2026-10-07", apitest.Posting(b.checking, -500), apitest.Posting(b.savings, 500))
	dispatch(t, b.h)

	if _, postings := categoryOf(t, b.h, history); postings[b.delivery] != 4500 {
		t.Fatalf("history postings = %v", postings)
	}
	var st map[string]any
	b.h.MustDo(http.MethodGet, "/api/v1/categorization-statistics?from=2026-10-01&to=2026-10-31", nil, http.StatusOK, &st)
	want := map[string]any{"from": "2026-10-01", "to": "2026-10-31", "total": float64(5), "rule": float64(1), "source": float64(0),
		"history": float64(1), "manual": float64(2), "uncategorized": float64(1)}
	for k, v := range want {
		if st[k] != v {
			t.Fatalf("statistics = %v, want %v", st, want)
		}
	}
	b.h.ExpectProblem(b.h.Do(http.MethodGet, "/api/v1/categorization-statistics?from=2026-10-01", nil), http.StatusBadRequest, "invalid_request", "to")
}
