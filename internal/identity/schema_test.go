package identity_test

import (
	"bytes"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

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

func TestMembershipSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	member, books := pgtest.CreateMember(t, pool)

	var other int64
	if err := pool.QueryRow(t.Context(), `INSERT INTO identity_books (region) VALUES ('US') RETURNING id`).Scan(&other); err != nil {
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
