package assistant_test

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

const (
	checkViolation      = "23514"
	foreignKeyViolation = "23503"
)

func TestSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	a, b := pgtest.CreateUser(t, pool), pgtest.CreateUser(t, pool)
	const provider = "11111111-1111-1111-1111-111111111111"
	if _, err := pool.Exec(ctx, `INSERT INTO assistant_provider (id, user_id, preset, name, base_url, created_at)
		VALUES ($1, $2, 'ollama', 'Local', 'http://127.0.0.1:11434/v1', now())`, provider, a); err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name, sql string
		args      []any
		code      string
	}{
		{"preset pattern", `INSERT INTO assistant_provider VALUES (gen_random_uuid(), $1, 'Bad-Preset', 'x', 'http://h', NULL, now())`, []any{a}, checkViolation},
		{"empty name", `INSERT INTO assistant_provider VALUES (gen_random_uuid(), $1, 'ollama', '', 'http://h', NULL, now())`, []any{a}, checkViolation},
		{"base URL scheme", `INSERT INTO assistant_provider VALUES (gen_random_uuid(), $1, 'ollama', 'x', 'ftp://h', NULL, now())`, []any{a}, checkViolation},
		{"use pattern", `INSERT INTO assistant_chain_target VALUES ($1, 'Bad Use', 0, $2, 'm', '{}')`, []any{a, provider}, checkViolation},
		{"negative position", `INSERT INTO assistant_chain_target VALUES ($1, 'assistant.chat', -1, $2, 'm', '{}')`, []any{a, provider}, checkViolation},
		{"empty model", `INSERT INTO assistant_chain_target VALUES ($1, 'assistant.chat', 0, $2, '', '{}')`, []any{a, provider}, checkViolation},
		{"unknown capability", `INSERT INTO assistant_chain_target VALUES ($1, 'assistant.chat', 0, $2, 'm', '{speech}')`, []any{a, provider}, checkViolation},
		{"another user's provider", `INSERT INTO assistant_chain_target VALUES ($1, 'assistant.chat', 0, $2, 'm', '{}')`, []any{b, provider}, foreignKeyViolation},
	}
	for _, tt := range tests {
		_, err := pool.Exec(ctx, tt.sql, tt.args...)
		pgErr, ok := errors.AsType[*pgconn.PgError](err)
		if !ok || pgErr.Code != tt.code {
			t.Errorf("%s: error = %v, want SQLSTATE %s", tt.name, err, tt.code)
		}
	}
}
