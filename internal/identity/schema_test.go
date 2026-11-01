package identity_test

import (
	"bytes"
	"errors"
	"fmt"
	"slices"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// checkViolation is the PostgreSQL SQLSTATE for check_violation.
const checkViolation = "23514"

func TestProfileSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	pgtest.CreateMember(t, pool)

	for _, set := range []struct{ table, assignment string }{
		{"identity_member", "language = 'PT'"},
		{"identity_books", "region = 'br'"},
		{"identity_member", "language = 'p'"},
		{"identity_books", "region = 'BRA'"},
	} {
		_, err := pool.Exec(t.Context(), "UPDATE "+set.table+" SET "+set.assignment)

		pgErr, ok := errors.AsType[*pgconn.PgError](err)
		if !ok || pgErr.Code != checkViolation {
			t.Errorf("UPDATE %s SET %s: error = %v, want check violation", set.table, set.assignment, err)
		}
	}
}

// uniqueViolation is the PostgreSQL SQLSTATE for unique_violation.
const uniqueViolation = "23505"

// foreignKeyViolation is the PostgreSQL SQLSTATE for foreign_key_violation.
const foreignKeyViolation = "23503"

// notNullViolation is the PostgreSQL SQLSTATE for not_null_violation.
const notNullViolation = "23502"

func TestAppearanceSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	member, _ := pgtest.CreateMember(t, pool)

	for _, tt := range []struct {
		sql  string
		code string
	}{
		{`UPDATE identity_member SET appearance = '[]' WHERE id = $1`, checkViolation},
		{`UPDATE identity_member SET appearance = 'null' WHERE id = $1`, checkViolation},
		{`UPDATE identity_member SET appearance = NULL WHERE id = $1`, notNullViolation},
	} {
		_, err := pool.Exec(t.Context(), tt.sql, member)
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); !ok || pgErr.Code != tt.code {
			t.Errorf("%s: error = %v, want SQLSTATE %s", tt.sql, err, tt.code)
		}
	}
}

func TestSecondFactorSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	member, _ := pgtest.CreateMember(t, pool)

	passkey := func(credential, algorithm, name string) string {
		return fmt.Sprintf(`INSERT INTO identity_passkey (id, member_id, credential_id, public_key, algorithm, sign_count, rp_id, name, created_at)
			VALUES (gen_random_uuid(), $1, '%s', '\x02', %s, 0, 'localhost', %s, now())`, credential, algorithm, name)
	}
	if _, err := pool.Exec(t.Context(), passkey(`\x01`, "-7", "'Phone'"), member); err != nil {
		t.Fatal(err)
	}

	recovery := `INSERT INTO identity_recovery_code (member_id, code_hash, created_at) VALUES ($1, '\x01', now())`
	if _, err := pool.Exec(t.Context(), recovery, member); err != nil {
		t.Fatal(err)
	}

	for _, tt := range []struct {
		name string
		sql  string
		args []any
		code string
	}{
		{"duplicate credential ID", passkey(`\x01`, "-7", "'Phone'"), []any{member}, uniqueViolation},
		{"algorithm outside the set", passkey(`\x03`, "-35", "'Phone'"), []any{member}, checkViolation},
		{"empty name", passkey(`\x04`, "-7", "''"), []any{member}, checkViolation},
		{"name of 61 characters", passkey(`\x05`, "-7", "repeat('a', 61)"), []any{member}, checkViolation},
		{"second recovery code with the same hash", recovery, []any{member}, uniqueViolation},
		{"TOTP of an absent member", `INSERT INTO identity_totp (member_id, sealed_secret, created_at) VALUES (-1, '\x01', now())`, nil, foreignKeyViolation},
		{"login challenge of an absent member", `INSERT INTO identity_login_challenge (token_hash, member_id, challenge, expires_at) VALUES ('\x01', -1, '\x02', now())`, nil, foreignKeyViolation},
	} {
		_, err := pool.Exec(t.Context(), tt.sql, tt.args...)
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); !ok || pgErr.Code != tt.code {
			t.Errorf("%s: error = %v, want SQLSTATE %s", tt.name, err, tt.code)
		}
	}

	if _, err := pool.Exec(t.Context(), `DELETE FROM identity_member WHERE id = $1`, member); err != nil {
		t.Fatal(err)
	}

	var left int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM identity_passkey WHERE member_id = $1`, member).Scan(&left); err != nil {
		t.Fatal(err)
	}

	if left != 0 {
		t.Errorf("passkeys after deleting the member = %d, want 0", left)
	}
}

func TestMembershipSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	member, books := pgtest.CreateMember(t, pool)

	var other int64
	if err := pool.QueryRow(t.Context(), `INSERT INTO identity_books (region, name) VALUES ('US', 'test') RETURNING id`).Scan(&other); err != nil {
		t.Fatal(err)
	}

	session := `INSERT INTO identity_session (token_hash, member_id, books_id, created_at, expires_at)
		VALUES ($1, $2, $3, '2026-10-27T12:00:00Z', '2026-11-27T12:00:00Z')`
	token := `INSERT INTO identity_access_token (id, member_id, books_id, name, scope, token_hash, created_at, expires_at)
		VALUES (gen_random_uuid(), $1, $2, 'x', 'read', $3, '2026-10-27T12:00:00Z', '2026-11-27T12:00:00Z')`

	for _, tt := range []struct {
		name string
		sql  string
		args []any
		code string
	}{
		{"role outside the set", `INSERT INTO identity_membership (member_id, books_id, role) VALUES ($1, $2, 'admin')`, []any{member, other}, checkViolation},
		{"second row of the pair", `INSERT INTO identity_membership (member_id, books_id, role) VALUES ($1, $2, 'read')`, []any{member, books}, uniqueViolation},
		{"session of a books without membership", session, []any{bytes.Repeat([]byte{9}, 32), member, other}, foreignKeyViolation},
	} {
		_, err := pool.Exec(t.Context(), tt.sql, tt.args...)
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); !ok || pgErr.Code != tt.code {
			t.Errorf("%s: error = %v, want SQLSTATE %s", tt.name, err, tt.code)
		}
	}

	if _, err := pool.Exec(t.Context(), session, bytes.Repeat([]byte{1}, 32), member, books); err != nil {
		t.Fatal(err)
	}

	if _, err := pool.Exec(t.Context(), token, member, books, bytes.Repeat([]byte{2}, 32)); err != nil {
		t.Fatal(err)
	}

	if _, err := pool.Exec(t.Context(), `DELETE FROM identity_membership WHERE member_id = $1 AND books_id = $2`, member, books); err != nil {
		t.Fatal(err)
	}

	for _, table := range []string{"identity_session", "identity_access_token"} {
		var n int
		if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM `+table).Scan(&n); err != nil || n != 0 {
			t.Errorf("rows of %s after the membership is deleted = %d, %v; want 0", table, n, err)
		}
	}
}

func TestAccessTokenSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	member, books := pgtest.CreateMember(t, pool)
	insert := `INSERT INTO identity_access_token (id, member_id, books_id, name, scope, token_hash, created_at, expires_at)
		VALUES (gen_random_uuid(), $1, $2, 'x', $3, $4, '2026-10-27T12:00:00Z', $5)`

	hash := func(b byte) []byte { return bytes.Repeat([]byte{b}, 32) }
	if _, err := pool.Exec(t.Context(), insert, member, books, "read", hash(1), "2026-11-27T12:00:00Z"); err != nil {
		t.Fatal(err)
	}

	for _, tt := range []struct {
		name    string
		scope   string
		hash    []byte
		expires string
		code    string
	}{
		{"duplicate token_hash", "read", hash(1), "2026-11-27T12:00:00Z", uniqueViolation},
		{"scope outside the set", "admin", hash(2), "2026-11-27T12:00:00Z", checkViolation},
		{"expires_at equals created_at", "write", hash(3), "2026-10-27T12:00:00Z", checkViolation},
	} {
		_, err := pool.Exec(t.Context(), insert, member, books, tt.scope, tt.hash, tt.expires)
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); !ok || pgErr.Code != tt.code {
			t.Errorf("%s: error = %v, want SQLSTATE %s", tt.name, err, tt.code)
		}
	}
}

// BK8: a business row names an existing book; the insert is rejected when the book is unknown or null.
func TestBusinessRowNeedsBooks(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	_, books := pgtest.CreateMember(t, pool)

	var account string
	if err := pool.QueryRow(t.Context(), `INSERT INTO ledger_account (books_id, name, account_class, kind, instrument, opened_on) VALUES ($1, 'Checking', 'asset', 'checking', 'BRL', '2026-10-30') RETURNING id`, books).Scan(&account); err != nil {
		t.Fatal(err)
	}

	direct := `INSERT INTO ledger_account (books_id, name, account_class, kind, instrument, opened_on) VALUES ($1, 'Savings', 'asset', 'savings', 'BRL', '2026-10-30')`
	composite := `INSERT INTO ledger_balance_assertion (books_id, account_id, date, amount) VALUES ($1, $2, '2026-10-30', 0)`

	for _, tt := range []struct {
		name string
		sql  string
		args []any
		code string
	}{
		{"direct key, unknown book", direct, []any{-1}, foreignKeyViolation},
		{"direct key, null book", direct, []any{nil}, notNullViolation},
		{"composite key, unknown book", composite, []any{-1, account}, foreignKeyViolation},
		{"composite key, null book", composite, []any{nil, account}, notNullViolation},
	} {
		_, err := pool.Exec(t.Context(), tt.sql, tt.args...)
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); !ok || pgErr.Code != tt.code {
			t.Errorf("%s: error = %v, want SQLSTATE %s", tt.name, err, tt.code)
		}
	}
}

func TestEveryBooksColumnReachesBooks(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)

	for _, tt := range []struct{ name, query string }{
		{"tables with user_id", `SELECT table_name FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'user_id'`},
		{"nullable books_id", `SELECT table_name FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'books_id' AND is_nullable = 'YES'`},
		{"books_id not reaching identity_books", unreachedBooksTables},
	} {
		if got := tableNames(t, pool, tt.query); len(got) != 0 {
			t.Errorf("%s: %v; want none", tt.name, got)
		}
	}
}

func TestBooksReachDetectsMissingKey(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)

	if _, err := pool.Exec(t.Context(), `ALTER TABLE ledger_settings DROP CONSTRAINT ledger_settings_user_id_fkey`); err != nil {
		t.Fatal(err)
	}

	if got := tableNames(t, pool, unreachedBooksTables); !slices.Equal(got, []string{"ledger_settings"}) {
		t.Errorf("unreached tables = %v; want [ledger_settings]", got)
	}
}

// unreachedBooksTables lists the tables whose books_id has no chain of not-null foreign keys to identity_books (id).
const unreachedBooksTables = `WITH RECURSIVE fk AS (
    SELECT c.conrelid AS tbl, c.confrelid AS ref
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey) AND a.attname = 'books_id'
    JOIN pg_attribute r ON r.attrelid = c.confrelid AND r.attnum = c.confkey[array_position(c.conkey, a.attnum)]
    WHERE c.contype = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_attribute n WHERE n.attrelid = c.conrelid AND n.attnum = ANY (c.conkey) AND NOT n.attnotnull)
      AND (r.attname = 'books_id' OR (c.confrelid = 'identity_books'::regclass AND r.attname = 'id'))
), reach AS (
    SELECT tbl FROM fk WHERE ref = 'identity_books'::regclass
    UNION
    SELECT fk.tbl FROM fk JOIN reach ON fk.ref = reach.tbl
)
SELECT c.relname FROM pg_class c
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'books_id' AND NOT a.attisdropped
WHERE c.relkind = 'r' AND c.relnamespace = current_schema()::regnamespace
  AND c.oid NOT IN (SELECT tbl FROM reach)
ORDER BY 1`

func tableNames(t *testing.T, pool *pgxpool.Pool, query string) []string {
	t.Helper()

	rows, err := pool.Query(t.Context(), query)
	if err != nil {
		t.Fatalf("%s: %v", query, err)
	}

	names, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatalf("%s: %v", query, err)
	}

	slices.Sort(names)

	return names
}

// HA23: one pending invitation per email and book; the token hash is unique.
func TestInvitationSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	member, books := pgtest.CreateMember(t, pool)

	var other int64
	if err := pool.QueryRow(t.Context(), `INSERT INTO identity_books (region, name) VALUES ('US', 'test') RETURNING id`).Scan(&other); err != nil {
		t.Fatal(err)
	}

	insert := `INSERT INTO identity_invitation (id, books_id, email, role, token_hash, invited_by, created_at, expires_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, '2026-10-30T12:00:00Z', '2026-11-06T12:00:00Z')`

	if _, err := pool.Exec(t.Context(), insert, books, "b@example.com", "read", bytes.Repeat([]byte{2}, 32), member); err != nil {
		t.Fatal(err)
	}

	for _, tt := range []struct {
		name string
		args []any
		code string
	}{
		{"role outside the set", []any{books, "a@example.com", "admin", bytes.Repeat([]byte{1}, 32), member}, checkViolation},
		{"second row of the pair", []any{books, "b@example.com", "read", bytes.Repeat([]byte{3}, 32), member}, uniqueViolation},
		{"second row of the token hash", []any{books, "c@example.com", "read", bytes.Repeat([]byte{2}, 32), member}, uniqueViolation},
	} {
		_, err := pool.Exec(t.Context(), insert, tt.args...)
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); !ok || pgErr.Code != tt.code {
			t.Errorf("%s: error = %v, want SQLSTATE %s", tt.name, err, tt.code)
		}
	}

	if _, err := pool.Exec(t.Context(), insert, other, "d@example.com", "read", bytes.Repeat([]byte{4}, 32), member); err != nil {
		t.Fatal(err)
	}

	if _, err := pool.Exec(t.Context(), `DELETE FROM identity_books WHERE id = $1`, other); err != nil {
		t.Fatal(err)
	}

	var n int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM identity_invitation WHERE books_id = $1`, other).Scan(&n); err != nil || n != 0 {
		t.Errorf("invitations of the deleted book = %d, %v; want 0", n, err)
	}
}

// One pending account invitation per email; the token hash is unique; the region and the currency
// keep their shapes.
func TestAccountInvitationSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	member, _ := pgtest.CreateMember(t, pool)

	insert := `INSERT INTO identity_account_invitation (id, email, region, base_currency, token_hash, invited_by, created_at, expires_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, '2026-11-01T12:00:00Z', '2026-11-08T12:00:00Z')`

	if _, err := pool.Exec(t.Context(), insert, "a@example.com", "BR", "BRL", bytes.Repeat([]byte{1}, 32), member); err != nil {
		t.Fatal(err)
	}

	for _, tt := range []struct {
		name string
		args []any
		code string
	}{
		{"second row of the email", []any{"a@example.com", "BR", "BRL", bytes.Repeat([]byte{2}, 32), member}, uniqueViolation},
		{"second row of the token hash", []any{"b@example.com", "BR", "BRL", bytes.Repeat([]byte{1}, 32), member}, uniqueViolation},
		{"region in lower case", []any{"c@example.com", "br", "BRL", bytes.Repeat([]byte{3}, 32), member}, checkViolation},
		{"currency of two letters", []any{"d@example.com", "BR", "BR", bytes.Repeat([]byte{4}, 32), member}, checkViolation},
	} {
		_, err := pool.Exec(t.Context(), insert, tt.args...)
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); !ok || pgErr.Code != tt.code {
			t.Errorf("%s: error = %v, want SQLSTATE %s", tt.name, err, tt.code)
		}
	}
}
