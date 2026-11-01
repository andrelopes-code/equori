package identity_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// DB5: one DELETE of the books row removes every row that carries its books_id.
func TestDeletingBooksRowCascades(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	booksID := h.OwnerID()

	checking := h.Account("Checking", "asset", "checking", nil)
	salary := h.Account("Salary", "income", "", nil)
	rent := h.Account("Rent", "expense", "", nil)
	h.Record("2026-10-05", apitest.Posting(checking, 100000), apitest.Posting(salary, -100000))
	h.MustDo(http.MethodPost, "/api/v1/schedules", map[string]any{
		"kind": "bill", "account_id": checking, "counterpart_id": rent, "description": "rent",
		"amount": apitest.BRL(50000),
		"recurrence": map[string]any{
			"frequency": "monthly", "interval": 1, "day_of_month": 5, "start": "2026-11-05",
		},
	}, http.StatusCreated, nil)
	h.Dispatch()

	tables := h.Rows(`SELECT table_name FROM information_schema.columns c
		WHERE column_name = 'books_id' AND table_schema = 'public'
		AND (SELECT table_type FROM information_schema.tables t
			WHERE t.table_schema = c.table_schema AND t.table_name = c.table_name) = 'BASE TABLE'
		ORDER BY 1`)

	before := rowsOf(t, h, tables, booksID)
	if len(before) < 8 {
		t.Fatalf("tables holding rows of the book = %v, want at least 8", before)
	}

	deleteBooksRow(t, h, booksID)

	if left := rowsOf(t, h, tables, booksID); len(left) != 0 {
		t.Fatalf("rows left after deleting the books row: %v", left)
	}
}

// deleteBooksRow runs the statement of DB5: the checks of the composite keys wait for the commit.
func deleteBooksRow(t *testing.T, h *apitest.Harness, booksID int64) {
	t.Helper()

	tx, err := h.Pool.Begin(t.Context())
	if err != nil {
		t.Fatalf("begin: %v", err)
	}

	defer func() { _ = tx.Rollback(t.Context()) }()

	if _, err := tx.Exec(t.Context(), `SET CONSTRAINTS ALL DEFERRED`); err != nil {
		t.Fatalf("defer constraints: %v", err)
	}

	if _, err := tx.Exec(t.Context(), `DELETE FROM identity_books WHERE id = $1`, booksID); err != nil {
		t.Fatalf("delete books: %v", err)
	}

	if err := tx.Commit(t.Context()); err != nil {
		t.Fatalf("commit: %v", err)
	}
}

// rowsOf maps each table to its row count for the books, leaving out the empty ones.
func rowsOf(t *testing.T, h *apitest.Harness, tables []string, booksID int64) map[string]int {
	t.Helper()

	counts := map[string]int{}

	for _, table := range tables {
		var n int
		if err := h.Pool.QueryRow(t.Context(), fmt.Sprintf(`SELECT count(*) FROM %s WHERE books_id = $1`, table), booksID).Scan(&n); err != nil {
			t.Fatalf("count %s: %v", table, err)
		}

		if n > 0 {
			counts[table] = n
		}
	}

	return counts
}
