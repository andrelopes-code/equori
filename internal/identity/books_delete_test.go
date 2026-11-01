package identity_test

import (
	"fmt"
	"net/http"
	"strings"
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

	orphans := h.Rows(`SELECT c.relname FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
		JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'books_id' AND NOT a.attisdropped
		WHERE c.relkind = 'r' AND NOT EXISTS (
			SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'f'
			AND (k.confrelid IN ('identity_books'::regclass, 'identity_membership'::regclass)
				OR EXISTS (SELECT 1 FROM pg_attribute b
					WHERE b.attrelid = k.confrelid AND b.attname = 'books_id' AND NOT b.attisdropped)))
		ORDER BY 1`)
	if len(orphans) != 0 {
		t.Fatalf("tables with books_id and no foreign key to a book or a table of a book: %v", orphans)
	}

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

// DB1, DB5, DB6: the owner deletes the active book; its rows go and the session ends.
func TestDeleteCurrentBooks(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	home := h.OwnerID()

	var created booksMembership
	h.MustDo(http.MethodPost, "/api/v1/books", map[string]any{"name": "Casal", "region": "BR"}, http.StatusCreated, &created)
	h.Dispatch()
	expectStatus(t, h.Do(http.MethodPut, "/api/v1/session/books", map[string]any{"books_id": created.ID}), http.StatusNoContent)
	h.Account("Checking", "asset", "checking", nil)

	r := h.Do(http.MethodDelete, "/api/v1/books/current", map[string]any{"name": "Casal"})
	expectStatus(t, r, http.StatusNoContent)

	cookies := (&http.Response{Header: r.Header}).Cookies()
	if len(cookies) != 1 || cookies[0].Name != "equori_session" || cookies[0].Expires.Unix() != 0 {
		t.Errorf("cookies = %+v, want equori_session expired at the Unix epoch", cookies)
	}

	var books, accounts int
	if err := h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM identity_books WHERE id = $1`, created.ID).Scan(&books); err != nil || books != 0 {
		t.Fatalf("books rows = %d, %v; want 0", books, err)
	}

	if err := h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM ledger_account WHERE books_id = $1`, created.ID).Scan(&accounts); err != nil || accounts != 0 {
		t.Fatalf("account rows = %d, %v; want 0", accounts, err)
	}

	var list struct {
		Items []booksMembership `json:"items"`
	}

	r = h.Call(h.SignIn("owner@example.com"), http.MethodGet, "/api/v1/me/books", nil)
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &list)

	if len(list.Items) != 1 || list.Items[0].ID != home {
		t.Fatalf("books after the delete = %+v, want only %d", list.Items, home)
	}
}

// DB2, DB3, DB4 and HA13: the refusals of a delete.
func TestDeleteCurrentBooksRefusals(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")

	t.Run("the book name must be typed", func(t *testing.T) {
		var created booksMembership
		h.MustDo(http.MethodPost, "/api/v1/books", map[string]any{"name": "Casal", "region": "BR"}, http.StatusCreated, &created)
		expectStatus(t, h.Do(http.MethodPut, "/api/v1/session/books", map[string]any{"books_id": created.ID}), http.StatusNoContent)

		h.ExpectProblem(h.Do(http.MethodDelete, "/api/v1/books/current", map[string]any{"name": "casal"}), http.StatusUnprocessableEntity, "confirmation_mismatch", "")
	})

	t.Run("a role below owner is refused", func(t *testing.T) {
		h.ExpectProblem(h.Call(writer, http.MethodDelete, "/api/v1/books/current", map[string]any{"name": "x"}), http.StatusForbidden, "book_role_required", "")
	})

	t.Run("another member keeps the book", func(t *testing.T) {
		var created booksMembership
		h.MustDo(http.MethodPost, "/api/v1/books", map[string]any{"name": "Dupla", "region": "BR"}, http.StatusCreated, &created)
		expectStatus(t, h.Do(http.MethodPut, "/api/v1/session/books", map[string]any{"books_id": created.ID}), http.StatusNoContent)
		h.Pool.Exec(t.Context(), `INSERT INTO identity_membership (member_id, books_id, role) VALUES ($1, $2, 'read')`, h.MemberIDOf("writer@example.com"), created.ID)

		h.ExpectProblem(h.Do(http.MethodDelete, "/api/v1/books/current", map[string]any{"name": "Dupla"}), http.StatusConflict, "books_has_members", "")
	})
}

// DB4: a member keeps at least one book.
func TestDeleteOnlyBooks(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	var books struct {
		Name string `json:"name"`
	}

	h.MustDo(http.MethodGet, "/api/v1/books/current", nil, http.StatusOK, &books)

	h.ExpectProblem(h.Do(http.MethodDelete, "/api/v1/books/current", map[string]any{"name": books.Name}), http.StatusConflict, "last_books", "")
}

// A book deleted before the dispatcher read its books_created event leaves no failing event behind.
func TestDeleteBooksBeforeItsEventIsDispatched(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	var created booksMembership
	h.MustDo(http.MethodPost, "/api/v1/books", map[string]any{"name": "Engano", "region": "BR"}, http.StatusCreated, &created)
	expectStatus(t, h.Do(http.MethodPut, "/api/v1/session/books", map[string]any{"books_id": created.ID}), http.StatusNoContent)
	expectStatus(t, h.Do(http.MethodDelete, "/api/v1/books/current", map[string]any{"name": "Engano"}), http.StatusNoContent)

	h.Dispatch()

	if logs := h.Logs(); strings.Contains(logs, "level=ERROR") {
		t.Fatalf("the dispatcher logged an error:\n%s", logs)
	}

	var settings int
	if err := h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM ledger_settings WHERE books_id = $1`, created.ID).Scan(&settings); err != nil || settings != 0 {
		t.Fatalf("settings of the deleted book = %d, %v; want 0", settings, err)
	}
}
