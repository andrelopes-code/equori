package ledger

import (
	"strings"
	"testing"
)

func TestDBReconciliationNeedsOneSubject(t *testing.T) {
	t.Parallel()
	f := newCardFixture(t)
	var assertion string
	if err := f.pool.QueryRow(t.Context(), `
		INSERT INTO ledger_balance_assertion (user_id, account_id, date, amount, source)
		VALUES ($1, $2, '2026-10-31', 0, 'manual') RETURNING id`, f.userID, f.checking).Scan(&assertion); err != nil {
		t.Fatal(err)
	}
	insert := `INSERT INTO ledger_reconciliation (user_id, account_id, date, assertion_id, statement_id, difference, resolution)
		VALUES ($1, $2, '2026-10-31', nullif($3, '')::uuid, nullif($4, '')::uuid, 0, 'none')`
	_, err := f.pool.Exec(t.Context(), insert, f.userID, f.checking, "", "")
	requireViolation(t, err, checkViolation, "")
	_, err = f.pool.Exec(t.Context(), insert, f.userID, f.checking, assertion, f.statement)
	requireViolation(t, err, checkViolation, "")
	if _, err := f.pool.Exec(t.Context(), insert, f.userID, f.checking, assertion, ""); err != nil {
		t.Fatal(err)
	}
}

func TestDBAttachmentBlobLimits(t *testing.T) {
	t.Parallel()
	f := newCardFixture(t)
	_, err := f.pool.Exec(t.Context(), `
		INSERT INTO ledger_attachment_blob (user_id, sha256, size, content) VALUES ($1, 'x', 10485761, '')`, f.userID)
	requireViolation(t, err, checkViolation, "")
}

func TestDBAttachmentRejectsOtherUsersBlob(t *testing.T) {
	t.Parallel()
	f := newCardFixture(t)
	id, err := f.recordTx(t, f.userID, "2026-03-01", postingRow{f.checking, -100}, postingRow{f.food, 100})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(t.Context(), `
		INSERT INTO ledger_attachment_blob (user_id, sha256, size, content) VALUES ($1, 'abc', 3, 'abc')`, f.userID); err != nil {
		t.Fatal(err)
	}
	var anotherUser int64
	if err := f.pool.QueryRow(t.Context(), `INSERT INTO identity_user (email, password_hash, role, language, region) VALUES ($1, 'x', 'member', 'en', 'US') RETURNING id`,
		strings.Repeat("b", 5)+"@example.com").Scan(&anotherUser); err != nil {
		t.Fatal(err)
	}
	_, err = f.pool.Exec(t.Context(), `
		INSERT INTO ledger_attachment (user_id, transaction_id, sha256, file_name, media_type)
		VALUES ($1, $2, 'abc', 'r.pdf', 'application/pdf')`, anotherUser, id)
	requireViolation(t, err, foreignKeyViolation, "")
}
