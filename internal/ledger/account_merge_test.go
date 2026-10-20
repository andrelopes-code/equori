package ledger_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type mergeBooks struct {
	categoryTree
	travel, transport, salary string
}

func newMergeBooks(t *testing.T) mergeBooks {
	t.Helper()
	c := newCategoryTreeWith(t, apitest.Today("2026-11-05"))
	return mergeBooks{
		categoryTree: c,
		travel:       c.h.Account("Travel", "expense", "", nil),
		transport:    c.h.Account("Transport", "expense", "", nil),
		salary:       c.h.Account("Salary", "income", "", nil),
	}
}

func (m mergeBooks) merge(from, into string) apitest.Response {
	return m.h.Do(http.MethodPost, "/api/v1/accounts/"+from+"/merge", map[string]string{"into": into})
}

// A75, Review Focus 1 and 3: postings keep their amount and memo, children and the source
// move; a voided transaction stays.
func TestMergeMovesPostingsAndChildren(t *testing.T) {
	t.Parallel()
	m := newMergeBooks(t)
	lunch := apitest.Posting(m.food, 600)
	lunch["memo"] = "lunch"
	split := m.h.Record("2026-10-10", apitest.Posting(m.checking, -1000), lunch, apitest.Posting(m.travel, 400))
	voided := m.h.Record("2026-10-11", apitest.Posting(m.checking, -300), apitest.Posting(m.food, 300))
	m.h.MustDo(http.MethodPost, "/api/v1/transactions/"+voided+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)

	r := m.merge(m.food, m.travel)
	if r.Status != http.StatusOK {
		t.Fatalf("merge status %d: %s", r.Status, r.Body)
	}
	var into accountView
	r.Decode(t, &into)
	if into.ID != m.travel {
		t.Fatalf("merge returned %+v, want travel", into)
	}

	v := m.h.Transaction(split)
	if got := amountsByAccount(v); v.Version != 2 || len(v.Postings) != 3 || got[m.travel] != 1000 || got[m.food] != 0 {
		t.Fatalf("split after merge: version %d, %d postings, amounts %v", v.Version, len(v.Postings), got)
	}
	var memo string
	if err := m.h.Pool.QueryRow(t.Context(), `SELECT memo FROM ledger_posting WHERE transaction_id = $1 AND account_id = $2 AND amount = 600`, split, m.travel).Scan(&memo); err != nil || memo != "lunch" {
		t.Fatalf("moved posting memo = %q, %v", memo, err)
	}
	if v := m.h.Transaction(voided); v.Version != 1 || amountsByAccount(v)[m.food] != 300 {
		t.Fatalf("voided after merge: %+v", v)
	}
	for _, child := range []string{m.bakery, m.delivery} {
		if a := getAccount(t, m.h, child); a.ParentID != m.travel {
			t.Fatalf("child %s parent = %q, want travel", child, a.ParentID)
		}
	}
	m.requireClosedOn(t, "2026-11-05", m.food)
	var merged []struct {
		From string `json:"from"`
		Into string `json:"into"`
	}
	rows, err := m.h.Pool.Query(t.Context(), `SELECT payload FROM outbox_event WHERE type = 'ledger.categories_merged.v1' AND aggregate_id = $1`, m.food)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var raw []byte
		var p struct {
			From string `json:"from"`
			Into string `json:"into"`
		}
		if err := rows.Scan(&raw); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(raw, &p); err != nil {
			t.Fatal(err)
		}
		merged = append(merged, p)
	}
	if len(merged) != 1 || merged[0].From != m.food || merged[0].Into != m.travel {
		t.Fatalf("categories_merged events = %+v", merged)
	}
}

// Review Focus 2: a part on a third category is unchanged.
func TestMergeKeepsOtherSplitParts(t *testing.T) {
	t.Parallel()
	m := newMergeBooks(t)
	tx := m.h.Record("2026-10-10", apitest.Posting(m.checking, -1000), apitest.Posting(m.food, 700), apitest.Posting(m.transport, 300))
	m.h.MustDo(http.MethodPost, "/api/v1/accounts/"+m.food+"/merge", map[string]string{"into": m.travel}, http.StatusOK, nil)
	if got := amountsByAccount(m.h.Transaction(tx)); got[m.travel] != 700 || got[m.transport] != 300 || got[m.checking] != -1000 {
		t.Fatalf("postings = %v", got)
	}
}

func TestMergeRejections(t *testing.T) {
	t.Parallel()
	m := newMergeBooks(t)
	closed := m.h.Account("Closed", "expense", "", nil)
	m.h.MustDo(http.MethodPost, "/api/v1/accounts/"+closed+"/close", map[string]string{"closed_on": "2026-10-31"}, http.StatusOK, nil)
	for _, c := range []struct {
		name, from, into, code string
	}{
		{"self", m.food, m.food, "validation_failed"},
		{"other class", m.food, m.salary, "validation_failed"},
		{"closed destination", m.food, closed, "validation_failed"},
		{"destination in subtree", m.food, m.bakery, "validation_failed"},
		{"balance account", m.food, m.checking, "validation_failed"},
		{"system source", m.uncategorizedExpense, m.travel, "system_account"},
	} {
		t.Run(c.name, func(t *testing.T) {
			field := "into"
			if c.code == "system_account" {
				field = ""
			}
			m.h.ExpectProblem(m.merge(c.from, c.into), http.StatusUnprocessableEntity, c.code, field)
			m.requireClosedOn(t, "", c.from)
		})
	}
}
