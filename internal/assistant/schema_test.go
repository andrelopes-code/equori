package assistant_test

import (
	"errors"
	"strings"
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
	const conv = "22222222-2222-2222-2222-222222222222"
	if _, err := pool.Exec(ctx, `INSERT INTO assistant_conversation VALUES ($1, $2, 'T', now(), now())`, conv, a); err != nil {
		t.Fatal(err)
	}
	msg := func(user int64, role, content string, outcome any) (string, []any) {
		return `INSERT INTO assistant_message VALUES (gen_random_uuid(), $1, $2, 1, $3, $4, $5, now())`, []any{user, conv, role, content, outcome}
	}
	proposal := func(status, basis string, decided, expires string) (string, []any) {
		return `INSERT INTO assistant_proposal VALUES (gen_random_uuid(), $1, $2, NULL, 'create_transaction', '{}', '{}', $3, $4, NULL,
			'2026-10-23T10:00:00Z', $5::timestamptz, $6::timestamptz)`, []any{a, conv, basis, status, expires, nilIfEmpty(decided)}
	}
	hash := strings.Repeat("a", 64)
	other := func() (string, []any) { return msg(b, "user", "x", nil) }
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
	add := func(name string, f func() (string, []any), code string) {
		sql, args := f()
		tests = append(tests, struct {
			name, sql string
			args      []any
			code      string
		}{name, sql, args, code})
	}
	add("message of another user's conversation", other, foreignKeyViolation)
	add("role system", func() (string, []any) { return msg(a, "system", "x", nil) }, checkViolation)
	add("user message with outcome", func() (string, []any) { return msg(a, "user", "x", "answered") }, checkViolation)
	add("assistant message without outcome", func() (string, []any) { return msg(a, "assistant", "x", nil) }, checkViolation)
	add("content over 16000", func() (string, []any) { return msg(a, "assistant", strings.Repeat("x", 16001), "answered") }, checkViolation)
	add("assistant message unknown outcome", func() (string, []any) { return msg(a, "assistant", "", "lost") }, checkViolation)
	add("empty user content", func() (string, []any) { return msg(a, "user", "", nil) }, checkViolation)
	add("proposal status", func() (string, []any) { return proposal("done", hash, "", "2026-10-23T10:15:00Z") }, checkViolation)
	add("executed without decided_at", func() (string, []any) { return proposal("executed", hash, "", "2026-10-23T10:15:00Z") }, checkViolation)
	add("basis", func() (string, []any) { return proposal("pending", "abc", "", "2026-10-23T10:15:00Z") }, checkViolation)
	add("expires_at equals created_at", func() (string, []any) { return proposal("pending", hash, "", "2026-10-23T10:00:00Z") }, checkViolation)
	for _, tt := range tests {
		_, err := pool.Exec(ctx, tt.sql, tt.args...)
		pgErr, ok := errors.AsType[*pgconn.PgError](err)
		if !ok || pgErr.Code != tt.code {
			t.Errorf("%s: error = %v, want SQLSTATE %s", tt.name, err, tt.code)
		}
	}
	sql, args := msg(a, "assistant", "", "answered")
	if _, err := pool.Exec(ctx, sql, args...); err != nil {
		t.Errorf("assistant message with empty content rejected: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO assistant_message VALUES (gen_random_uuid(), $1, $2, 2, 'assistant', '', 'canceled', now())`, a, conv); err != nil {
		t.Errorf("assistant message canceled rejected: %v", err)
	}
}

func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
