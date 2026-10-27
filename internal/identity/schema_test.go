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
	pgtest.CreateUser(t, pool)
	for _, set := range []string{"language = 'PT'", "region = 'br'", "language = 'p'", "region = 'BRA'"} {
		_, err := pool.Exec(t.Context(), "UPDATE identity_user SET "+set)
		pgErr, ok := errors.AsType[*pgconn.PgError](err)
		if !ok || pgErr.Code != checkViolation {
			t.Errorf("UPDATE identity_user SET %s: error = %v, want check violation", set, err)
		}
	}
}

// uniqueViolation is the PostgreSQL SQLSTATE for unique_violation.
const uniqueViolation = "23505"

func TestAccessTokenSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	user := pgtest.CreateUser(t, pool)
	insert := `INSERT INTO identity_access_token (id, user_id, name, scope, token_hash, created_at, expires_at)
		VALUES (gen_random_uuid(), $1, 'x', $2, $3, '2026-10-27T12:00:00Z', $4)`
	hash := func(b byte) []byte { return bytes.Repeat([]byte{b}, 32) }
	if _, err := pool.Exec(t.Context(), insert, user, "read", hash(1), "2026-11-27T12:00:00Z"); err != nil {
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
		_, err := pool.Exec(t.Context(), insert, user, tt.scope, tt.hash, tt.expires)
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); !ok || pgErr.Code != tt.code {
			t.Errorf("%s: error = %v, want SQLSTATE %s", tt.name, err, tt.code)
		}
	}
}
