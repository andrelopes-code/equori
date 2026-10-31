package identity_test

import (
	"io"
	"log/slog"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// ADR 029: migration 69 separates the member from the books; backfilled books keep the member IDs (BK4).
func TestBooksBackfill(t *testing.T) {
	t.Parallel()
	pool := pgtest.Empty(t)
	ctx := t.Context()

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	if err := postgres.MigrateTo(ctx, pool, 68, log); err != nil {
		t.Fatal(err)
	}

	first := pgtest.CreateUserBeforeBooks(t, pool)
	second := pgtest.CreateUserBeforeBooks(t, pool)

	for _, sql := range []struct {
		query string
		args  []any
	}{
		{`UPDATE identity_user SET region = 'BR' WHERE id = $1`, []any{first}},
		{`INSERT INTO identity_session (token_hash, user_id, created_at, expires_at) VALUES ('\x01', $1, now(), now() + interval '1 day')`, []any{first}},
		{`INSERT INTO identity_access_token (id, user_id, name, scope, token_hash, created_at, expires_at)
			VALUES (gen_random_uuid(), $1, 'x', 'read', '\x0202020202020202020202020202020202020202020202020202020202020202', now(), now() + interval '1 day')`, []any{second}},
		{`INSERT INTO ledger_settings (user_id, base_currency) VALUES ($1, 'BRL')`, []any{first}},
	} {
		if _, err := pool.Exec(ctx, sql.query, sql.args...); err != nil {
			t.Fatalf("%s: %v", sql.query, err)
		}
	}

	if err := postgres.Migrate(ctx, pool, log); err != nil {
		t.Fatal(err)
	}

	pairs := func(query string) [][3]any {
		t.Helper()

		rows, err := pool.Query(ctx, query)
		if err != nil {
			t.Fatalf("%s: %v", query, err)
		}
		defer rows.Close()

		var out [][3]any

		for rows.Next() {
			var a, b int64

			var c string

			if err := rows.Scan(&a, &b, &c); err != nil {
				t.Fatalf("%s: %v", query, err)
			}

			out = append(out, [3]any{a, b, c})
		}

		return out
	}

	assertRows := func(query string, want ...[3]any) {
		t.Helper()

		got := pairs(query)
		if len(got) != len(want) {
			t.Fatalf("%s: rows = %v, want %v", query, got, want)
		}

		for i := range want {
			if got[i] != want[i] {
				t.Errorf("%s: row %d = %v, want %v", query, i, got[i], want[i])
			}
		}
	}

	assertRows(`SELECT id, id, region FROM identity_books ORDER BY id`, [3]any{first, first, "BR"}, [3]any{second, second, "US"})
	assertRows(`SELECT member_id, books_id, role FROM identity_membership ORDER BY member_id`,
		[3]any{first, first, "owner"}, [3]any{second, second, "owner"})
	assertRows(`SELECT member_id, books_id, '' FROM identity_session`, [3]any{first, first, ""})
	assertRows(`SELECT member_id, books_id, '' FROM identity_access_token`, [3]any{second, second, ""})

	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM information_schema.columns WHERE table_name = 'identity_member' AND column_name = 'region'`).Scan(&n); err != nil || n != 0 {
		t.Errorf("identity_member.region columns = %d, %v; want 0", n, err)
	}

	var next int64
	if err := pool.QueryRow(ctx, `INSERT INTO identity_books (region, name) VALUES ('PT', 'test') RETURNING id`).Scan(&next); err != nil || next <= second {
		t.Errorf("next books ID = %d, %v; want greater than %d", next, err, second)
	}

	var ref string
	if err := pool.QueryRow(ctx, `SELECT confrelid::regclass::text FROM pg_constraint WHERE conname = 'ledger_settings_user_id_fkey'`).Scan(&ref); err != nil || ref != "identity_books" {
		t.Errorf("ledger_settings_user_id_fkey references %q, %v; want identity_books", ref, err)
	}

	// The tables of ADR 030 hold a member's second factor, as identity_session holds its sessions.
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND confrelid = 'identity_member'::regclass AND conrelid NOT IN ('identity_session'::regclass, 'identity_access_token'::regclass, 'identity_membership'::regclass, 'identity_invitation'::regclass, 'identity_totp'::regclass, 'identity_recovery_code'::regclass, 'identity_passkey'::regclass, 'identity_passkey_challenge'::regclass, 'identity_login_challenge'::regclass)`).Scan(&n); err != nil || n != 0 {
		t.Errorf("business foreign keys to identity_member = %d, %v; want 0", n, err)
	}
}

// ADR 029, BK5, BK7: migration 70 renames the owner column of every business table and the key of the stored snapshots.
func TestBooksColumnRename(t *testing.T) {
	t.Parallel()
	pool := pgtest.Empty(t)
	ctx := t.Context()

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	if err := postgres.MigrateTo(ctx, pool, 69, log); err != nil {
		t.Fatal(err)
	}

	// pgtest.CreateMember lists the name column, which version 69 lacks.
	var books int64
	if err := pool.QueryRow(ctx, `INSERT INTO identity_books (region) VALUES ('US') RETURNING id`).Scan(&books); err != nil {
		t.Fatal(err)
	}

	var transaction string
	if err := pool.QueryRow(ctx, `INSERT INTO ledger_transaction (user_id, date, description, balancing_currency, origin) VALUES ($1, '2026-10-30', 'Coffee', 'BRL', 'manual') RETURNING id`, books).Scan(&transaction); err != nil {
		t.Fatal(err)
	}

	if _, err := pool.Exec(ctx, `INSERT INTO ledger_transaction_version (transaction_id, version, snapshot, reason) VALUES ($1, 1, jsonb_build_object('id', $1::uuid::text, 'user_id', $2::bigint, 'version', 1), 'edit')`, transaction, books); err != nil {
		t.Fatal(err)
	}

	if err := postgres.Migrate(ctx, pool, log); err != nil {
		t.Fatal(err)
	}

	var got int64
	if err := pool.QueryRow(ctx, `SELECT books_id FROM ledger_transaction`).Scan(&got); err != nil || got != books {
		t.Errorf("ledger_transaction.books_id = %d, %v; want %d", got, err, books)
	}

	var hasOld bool

	var snapshotBooks int64
	if err := pool.QueryRow(ctx, `SELECT snapshot ? 'user_id', (snapshot ->> 'books_id')::bigint FROM ledger_transaction_version`).Scan(&hasOld, &snapshotBooks); err != nil || hasOld || snapshotBooks != books {
		t.Errorf("snapshot keeps the old key = %t, books_id = %d, %v; want false, %d", hasOld, snapshotBooks, err, books)
	}
}
