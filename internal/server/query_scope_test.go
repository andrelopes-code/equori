package server_test

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

var (
	queryName  = regexp.MustCompile(`(?m)^-- name: (\w+) :\w+$`)
	queryTable = regexp.MustCompile(`(?i)\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]*)`)
)

// unscopedQueries lists the queries on a table with books_id that do not filter by books_id,
// with the reason each stays safe. A query outside this list must name books_id.
var unscopedQueries = map[string]string{
	"identity.CountMemberBooks":       "counts the memberships of one member",
	"identity.DeleteAccessToken":      "keyed by the member and the token",
	"identity.DeleteExpiredSessions":  "removes expired sessions of every member",
	"identity.DeleteMemberSessions":   "keyed by the member",
	"identity.DeleteOtherSessions":    "keyed by the member and the kept session",
	"identity.DeleteSession":          "keyed by the session",
	"identity.TouchAccessToken":       "keyed by the member and the token",
	"ledger.DeleteLinksFrom":          "child rows of a transaction the caller loaded within the book",
	"ledger.DeletePostings":           "child rows of a transaction the caller loaded within the book",
	"ledger.DeletePostingsByID":       "child rows of a transaction the caller loaded within the book",
	"ledger.DeleteTransactionTags":    "child rows of a transaction the caller loaded within the book",
	"ledger.NextPostingPosition":      "child rows of a transaction the caller loaded within the book",
	"ledger.ResolveDispute":           "the caller locks the dispute with LockDispute(booksID, id) first",
	"ledger.SetStatementFinanced":     "the caller loaded the statement within the book",
	"ledger.UpdateStatementDates":     "the caller loaded the statement within the book",
	"reporting.DeleteAccountDaysFrom": "keyed by an account the caller loaded within the book",
}

// ADR 003 and 029: every query on a table with books_id filters by books_id, unless it is listed
// in unscopedQueries.
func TestQueriesFilterByBooksID(t *testing.T) {
	t.Parallel()
	scoped := scopedTables(t)
	used := map[string]bool{}

	for _, q := range readQueries(t) {
		if strings.Contains(q.text, "books_id") {
			continue
		}

		if table, ok := firstScopedTable(q.text, scoped); ok {
			used[q.key] = true

			if _, listed := unscopedQueries[q.key]; !listed {
				t.Errorf("%s: query %s reads or writes %s without books_id", q.file, q.key, table)
			}
		}
	}

	for key := range unscopedQueries {
		if !used[key] {
			t.Errorf("unscopedQueries lists %s, which filters by books_id or no longer exists", key)
		}
	}
}

// query is one sqlc statement; key is "<module>.<name>", the module being the directory.
type query struct {
	file, key, text string
}

func scopedTables(t *testing.T) map[string]bool {
	t.Helper()

	rows, err := pgtest.New(t).Query(t.Context(),
		`SELECT table_name FROM information_schema.columns
		WHERE table_schema = 'public' AND column_name = 'books_id'`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	tables := map[string]bool{}

	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}

		tables[name] = true
	}

	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}

	return tables
}

func readQueries(t *testing.T) []query {
	t.Helper()

	var queries []query

	root := filepath.Join("..", "..", "db", "queries")

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || filepath.Ext(path) != ".sql" {
			return err
		}

		body, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		queries = append(queries, splitQueries(path, string(body))...)

		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	if len(queries) == 0 {
		t.Fatal("no query found under db/queries")
	}

	return queries
}

func splitQueries(file, body string) []query {
	marks := queryName.FindAllStringSubmatchIndex(body, -1)
	queries := make([]query, 0, len(marks))

	for i, m := range marks {
		end := len(body)
		if i+1 < len(marks) {
			end = marks[i+1][0]
		}

		key := filepath.Base(filepath.Dir(file)) + "." + body[m[2]:m[3]]
		queries = append(queries, query{file: file, key: key, text: body[m[0]:end]})
	}

	return queries
}

func firstScopedTable(text string, scoped map[string]bool) (string, bool) {
	var found []string

	for _, m := range queryTable.FindAllStringSubmatch(text, -1) {
		if scoped[strings.ToLower(m[1])] {
			found = append(found, strings.ToLower(m[1]))
		}
	}

	if len(found) == 0 {
		return "", false
	}

	slices.Sort(found)

	return found[0], true
}
