package ledger

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func TestDBReconciliationNeedsOneSubject(t *testing.T) {
	t.Parallel()
	f := newCardFixture(t)

	var assertion string
	if err := f.pool.QueryRow(t.Context(), `
		INSERT INTO ledger_balance_assertion (books_id, account_id, date, amount, source)
		VALUES ($1, $2, '2026-10-31', 0, 'manual') RETURNING id`, f.booksID, f.checking).Scan(&assertion); err != nil {
		t.Fatal(err)
	}

	insert := `INSERT INTO ledger_reconciliation (books_id, account_id, date, assertion_id, statement_id, difference, resolution)
		VALUES ($1, $2, '2026-10-31', nullif($3, '')::uuid, nullif($4, '')::uuid, 0, 'none')`
	_, err := f.pool.Exec(t.Context(), insert, f.booksID, f.checking, "", "")
	requireViolation(t, err, checkViolation, "")
	_, err = f.pool.Exec(t.Context(), insert, f.booksID, f.checking, assertion, f.statement)
	requireViolation(t, err, checkViolation, "")

	if _, err := f.pool.Exec(t.Context(), insert, f.booksID, f.checking, assertion, ""); err != nil {
		t.Fatal(err)
	}
}

func TestDBAttachmentBlobLimits(t *testing.T) {
	t.Parallel()
	f := newCardFixture(t)
	_, err := f.pool.Exec(t.Context(), `
		INSERT INTO ledger_attachment_blob (books_id, sha256, size, content) VALUES ($1, 'x', 10485761, '')`, f.booksID)
	requireViolation(t, err, checkViolation, "")
}

func TestDBAttachmentRejectsOtherUsersBlob(t *testing.T) {
	t.Parallel()
	f := newCardFixture(t)

	id, err := f.recordTx(t, f.booksID, "2026-03-01", postingRow{f.checking, -100}, postingRow{f.food, 100})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := f.pool.Exec(t.Context(), `
		INSERT INTO ledger_attachment_blob (books_id, sha256, size, content) VALUES ($1, 'abc', 3, 'abc')`, f.booksID); err != nil {
		t.Fatal(err)
	}

	anotherUser := pgtest.CreateBooks(t, f.pool)

	_, err = f.pool.Exec(t.Context(), `
		INSERT INTO ledger_attachment (books_id, transaction_id, sha256, file_name, media_type)
		VALUES ($1, $2, 'abc', 'r.pdf', 'application/pdf')`, anotherUser, id)
	requireViolation(t, err, foreignKeyViolation, "")
}
