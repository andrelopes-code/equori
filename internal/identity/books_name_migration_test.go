package identity_test

import (
	"errors"
	"io"
	"log/slog"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// HA1, HA2: migration 73 names the books after the owner with the lowest member ID and keeps the
// creation time of each membership as its last visit.
func TestBooksNameBackfill(t *testing.T) {
	t.Parallel()
	pool := pgtest.Empty(t)
	ctx := t.Context()

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	if err := postgres.MigrateTo(ctx, pool, 72, log); err != nil {
		t.Fatal(err)
	}

	insertMember := func(email string) int64 {
		t.Helper()

		var id int64

		err := pool.QueryRow(ctx,
			`INSERT INTO identity_member (email, password_hash, role, language) VALUES ($1, 'x', 'admin', 'en') RETURNING id`,
			email).Scan(&id)
		if err != nil {
			t.Fatal(err)
		}

		return id
	}

	insertBooks := func() int64 {
		t.Helper()

		var id int64
		if err := pool.QueryRow(ctx, `INSERT INTO identity_books (region) VALUES ('US') RETURNING id`).Scan(&id); err != nil {
			t.Fatal(err)
		}

		return id
	}

	a := insertMember("a@example.com")
	b := insertMember(strings.Repeat("x", 81) + "@example.com")
	aBooks, bBooks, empty := insertBooks(), insertBooks(), insertBooks()

	_, err := pool.Exec(ctx, `INSERT INTO identity_membership (member_id, books_id, role, created_at) VALUES
		($1, $2, 'owner', '2026-01-01T00:00:00Z'),
		($3, $4, 'owner', '2026-01-01T00:00:00Z'),
		($1, $4, 'write', '2026-01-02T00:00:00Z')`, a, aBooks, b, bBooks)
	if err != nil {
		t.Fatal(err)
	}

	if err := postgres.Migrate(ctx, pool, log); err != nil {
		t.Fatal(err)
	}

	for _, tt := range []struct {
		name  string
		books int64
		want  string
	}{
		{"owner email", aBooks, "a@example.com"},
		{"owner b, not the write member a, cut to 80", bBooks, strings.Repeat("x", 80)},
		{"book without owner", empty, "#" + strconv.FormatInt(empty, 10)},
	} {
		var got string
		if err := pool.QueryRow(ctx, `SELECT name FROM identity_books WHERE id = $1`, tt.books).Scan(&got); err != nil || got != tt.want {
			t.Errorf("%s: name = %q, %v; want %q", tt.name, got, err, tt.want)
		}
	}

	var visit time.Time
	if err := pool.QueryRow(ctx, `SELECT last_active_at FROM identity_membership WHERE member_id = $1 AND books_id = $2`, a, aBooks).Scan(&visit); err != nil {
		t.Fatal(err)
	}

	if want := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC); !visit.Equal(want) {
		t.Errorf("last_active_at = %s, want %s", visit, want)
	}

	_, err = pool.Exec(ctx, `UPDATE identity_books SET name = '' WHERE id = $1`, aBooks)

	pgErr, ok := errors.AsType[*pgconn.PgError](err)
	if !ok || pgErr.Code != "23514" {
		t.Errorf("empty name error = %v, want SQLSTATE 23514", err)
	}
}
