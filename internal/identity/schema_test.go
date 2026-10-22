package identity_test

import (
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
