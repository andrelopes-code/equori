package assistant_test

import (
	"io"
	"log/slog"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// HA28: migration 75 gives each conversation to the owner with the lowest member ID and deletes
// the conversations of a book without an owner.
func TestConversationMemberBackfill(t *testing.T) {
	t.Parallel()
	pool := pgtest.Empty(t)
	ctx := t.Context()

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	if err := postgres.MigrateTo(ctx, pool, 74, log); err != nil {
		t.Fatal(err)
	}

	m, b := pgtest.CreateMember(t, pool)

	var orphan int64
	if err := pool.QueryRow(ctx, `INSERT INTO identity_books (region, name) VALUES ('US', 'none') RETURNING id`).Scan(&orphan); err != nil {
		t.Fatal(err)
	}

	insert := func(booksID int64) uuid.UUID {
		t.Helper()

		id := uuid.New()
		if _, err := pool.Exec(ctx,
			`INSERT INTO assistant_conversation (id, books_id, title, created_at, updated_at) VALUES ($1, $2, 'T', now(), now())`,
			id, booksID); err != nil {
			t.Fatal(err)
		}

		if _, err := pool.Exec(ctx,
			`INSERT INTO assistant_message (id, books_id, conversation_id, seq, role, content, created_at)
			VALUES (gen_random_uuid(), $1, $2, 1, 'user', 'x', now())`, booksID, id); err != nil {
			t.Fatal(err)
		}

		return id
	}
	kept, dropped := insert(b), insert(orphan)

	if err := postgres.Migrate(ctx, pool, log); err != nil {
		t.Fatal(err)
	}

	var member int64
	if err := pool.QueryRow(ctx, `SELECT member_id FROM assistant_conversation WHERE id = $1`, kept).Scan(&member); err != nil || member != m {
		t.Fatalf("member_id of the conversation of the book = %d, %v; want %d", member, err, m)
	}

	var n int
	if err := pool.QueryRow(ctx,
		`SELECT (SELECT count(*) FROM assistant_conversation WHERE id = $1) + (SELECT count(*) FROM assistant_message WHERE conversation_id = $1)`,
		dropped).Scan(&n); err != nil || n != 0 {
		t.Fatalf("%d rows kept of the conversation of the book without an owner (%v)", n, err)
	}

	if _, err := pool.Exec(ctx, `DELETE FROM identity_membership WHERE member_id = $1 AND books_id = $2`, m, b); err != nil {
		t.Fatal(err)
	}

	if err := pool.QueryRow(ctx, `SELECT count(*) FROM assistant_conversation WHERE books_id = $1`, b).Scan(&n); err != nil || n != 0 {
		t.Fatalf("%d conversations kept after the membership was removed (%v)", n, err)
	}
}
