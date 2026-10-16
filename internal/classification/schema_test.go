package classification_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestSchemaInvariants(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	tx := h.Record("2026-10-01", apitest.Posting(checking, -100), apitest.Posting(food, 100))
	var payee struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": "iFood"}, http.StatusCreated, &payee)
	uid := h.OwnerID()
	ctx := t.Context()
	exec := func(sql string, args ...any) error {
		_, err := h.Pool.Exec(ctx, sql, args...)
		return err
	}
	rule := func(priority, version int) error {
		return exec(`INSERT INTO classification_rule (user_id, name, priority, enabled, stop_processing, conditions, actions, schema_version)
			VALUES ($1, 'r', $2, true, false, '[]', '[]', $3)`, uid, priority, version)
	}
	if err := rule(1, 1); err != nil {
		t.Fatal(err)
	}
	var ruleID string
	if err := h.Pool.QueryRow(ctx, `SELECT id FROM classification_rule WHERE user_id = $1`, uid).Scan(&ruleID); err != nil {
		t.Fatal(err)
	}
	alias := func(pattern, matchType string) error {
		return exec(`INSERT INTO classification_payee_alias (user_id, pattern, match_type, payee_id) VALUES ($1, $2, $3, $4)`, uid, pattern, matchType, payee.ID)
	}
	if err := alias("ifd*", "starts_with"); err != nil {
		t.Fatal(err)
	}
	suggestion := func(fingerprint, state string, ruleID any, decided bool) error {
		return exec(`INSERT INTO classification_suggestion (user_id, fingerprint, conditions, actions, example_transaction_ids, state, rule_id, created_at, decided_at)
			VALUES ($1, $2, '[]', '[]', ARRAY[$3::uuid, $3::uuid], $4, $5, now(), CASE WHEN $6 THEN now() END)`, uid, fingerprint, tx, state, ruleID, decided)
	}
	categorization := func(method, ruleID any, corrected bool) error {
		return exec(`INSERT INTO classification_categorization (transaction_id, user_id, transaction_version, transaction_date, method, rule_id, corrected, decided_at)
			VALUES ($1, $2, 1, '2026-10-01', $3, $4, $5, now())`, tx, uid, method, ruleID, corrected)
	}
	tests := []struct {
		name string
		err  error
	}{
		{"one rule per priority", rule(1, 1)},
		{"A41: a source category once per provider and id", func() error {
			source := `INSERT INTO classification_source_category (user_id, provider, external_id, name) VALUES ($1, 'pluggy', '05010000', 'Food')`
			if err := exec(source, uid); err != nil {
				return nil
			}
			return exec(source, uid)
		}()},
		{"A41: a source category maps to an account of its user", exec(`INSERT INTO classification_source_category (user_id, provider, external_id, name, category_id)
			VALUES ($1, 'pluggy', '07000000', 'Travel', gen_random_uuid())`, uid)},
		{"positive priority", rule(0, 1)},
		{"known rule schema version", rule(2, 2)},
		{"known alias match type", alias("ifood", "like")},
		{"one alias per pattern and match type", alias("ifd*", "starts_with")},
		{"one suggestion per fingerprint", func() error {
			if err := suggestion("f", "pending", nil, false); err != nil {
				t.Fatal(err)
			}
			return suggestion("f", "dismissed", nil, true)
		}()},
		{"only an accepted suggestion names a rule", suggestion("g", "dismissed", ruleID, true)},
		{"a pending suggestion has no decision time", suggestion("h", "pending", nil, true)},
		{"known categorization method", categorization("guess", nil, false)},
		{"only the rule method names a rule", categorization("manual", ruleID, false)},
		{"only a manual categorization is a correction", categorization("rule", ruleID, true)},
	}
	for _, tc := range tests {
		if tc.err == nil {
			t.Errorf("%s: accepted", tc.name)
		}
	}
	if err := categorization("rule", ruleID, false); err != nil {
		t.Fatalf("valid categorization: %v", err)
	}
	if err := exec(`DELETE FROM classification_rule WHERE id = $1`, ruleID); err != nil {
		t.Fatalf("delete rule: %v", err)
	}
	var method string
	var kept *string
	if err := h.Pool.QueryRow(ctx, `SELECT method, rule_id FROM classification_categorization WHERE transaction_id = $1`, tx).Scan(&method, &kept); err != nil || method != "rule" || kept != nil {
		t.Fatalf("after rule delete: method %q, rule %v, %v", method, kept, err)
	}
}
