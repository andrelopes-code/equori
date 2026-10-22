package ledger_test

import (
	"io"
	"log/slog"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// P5b amendment A27: migration 12 moves each record link from the transaction to the
// posting on the record's account.
func TestRecordLinksMoveToPostings(t *testing.T) {
	t.Parallel()
	pool := pgtest.Empty(t)
	ctx := t.Context()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	if err := postgres.MigrateTo(ctx, pool, 11, log); err != nil {
		t.Fatal(err)
	}
	uid := pgtest.CreateUserBeforeProfile(t, pool)
	var checking, savings, expense, batch, created, matched, createdRecord, matchedRecord string
	row := func(dst *string, sql string, args ...any) {
		t.Helper()
		if err := pool.QueryRow(ctx, sql, args...).Scan(dst); err != nil {
			t.Fatalf("%s: %v", sql, err)
		}
	}
	account := `INSERT INTO ledger_account (user_id, name, account_class, kind, instrument, opened_on) VALUES ($1, $2, $3, $4, 'BRL', '2026-01-01') RETURNING id`
	row(&checking, account, uid, "Checking", "asset", "checking")
	row(&savings, account, uid, "Savings", "asset", "savings")
	row(&expense, `INSERT INTO ledger_account (user_id, name, account_class, instrument, opened_on) VALUES ($1, 'Food', 'expense', 'BRL', '2026-01-01') RETURNING id`, uid)
	row(&batch, `INSERT INTO ingestion_batch (user_id, account_id, source, file_name, currency) VALUES ($1, $2, 'ofx', 'a.ofx', 'BRL') RETURNING id`, uid, checking)
	record := `INSERT INTO ingestion_external_record (user_id, batch_id, account_id, dedup_key, raw, booked_on, amount, description)
		VALUES ($1, $2, $3, $4, '{}', '2026-10-01', $5, 'x') RETURNING id`
	row(&createdRecord, record, uid, batch, checking, append(make([]byte, 31), 1), -100)
	row(&matchedRecord, record, uid, batch, savings, append(make([]byte, 31), 2), 100)

	tx := func(dst *string, origin, recordID, first, second string) {
		t.Helper()
		row(dst, `INSERT INTO ledger_transaction (user_id, date, description, balancing_currency, origin, external_record_id)
			VALUES ($1, '2026-10-01', 'x', 'BRL', $2, $3) RETURNING id`, uid, origin, recordID)
		if _, err := pool.Exec(ctx, `INSERT INTO ledger_posting (user_id, transaction_id, account_id, position, amount, weight, booked_on, status)
			VALUES ($1, $2, $3, 0, -100, -100, '2026-10-01', 'cleared'), ($1, $2, $4, 1, 100, 100, '2026-10-01', 'cleared')`, uid, *dst, first, second); err != nil {
			t.Fatal(err)
		}
	}
	tx(&created, "import", createdRecord, checking, expense)
	tx(&matched, "manual", matchedRecord, checking, savings)

	if err := postgres.Migrate(ctx, pool, log); err != nil {
		t.Fatal(err)
	}
	for _, want := range []struct{ transaction, account, record string }{
		{created, checking, createdRecord},
		{matched, savings, matchedRecord},
	} {
		var n int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM ledger_posting WHERE transaction_id = $1 AND external_record_id IS NOT NULL`, want.transaction).Scan(&n); err != nil || n != 1 {
			t.Fatalf("linked postings of %s = %d, %v", want.transaction, n, err)
		}
		var account string
		if err := pool.QueryRow(ctx, `SELECT account_id FROM ledger_posting WHERE external_record_id = $1`, want.record).Scan(&account); err != nil || account != want.account {
			t.Fatalf("record %s on account %s, want %s: %v", want.record, account, want.account, err)
		}
	}
}
