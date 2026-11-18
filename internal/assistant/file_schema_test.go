package assistant_test

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

const (
	notNullViolation = "23502"
	uniqueViolation  = "23505"
)

// Assistant parity design F1, B1 and F9: a conversation file belongs to one book and one member,
// holds its own size and hash, and one content is stored once per conversation.
func TestConversationFileSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	member, books := pgtest.CreateMember(t, pool)
	_, otherBooks := pgtest.CreateMember(t, pool)

	const conv = "33333333-3333-3333-3333-333333333333"
	if _, err := pool.Exec(
		ctx,
		`INSERT INTO assistant_conversation (id, books_id, member_id, title, created_at, updated_at)
		VALUES ($1, $2, $3, 'T', now(), now())`,
		conv,
		books,
		member,
	); err != nil {
		t.Fatal(err)
	}

	const insert = `INSERT INTO assistant_conversation_file
		(id, books_id, member_id, conversation_id, name, media_type, kind, size, sha256, content, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, 'text/plain', $5, $6, sha256($7::bytea), $7::bytea, now())`

	exec := func(books any, conversation any, name, kind string, size int, content string) error {
		_, err := pool.Exec(
			ctx,
			insert,
			books,
			member,
			conversation,
			name,
			kind,
			size,
			[]byte(content),
		)

		return err
	}

	if err := exec(books, conv, "a.txt", "text", 3, "abc"); err != nil {
		t.Fatalf("valid file: %v", err)
	}

	if err := exec(books, nil, "b.txt", "text", 3, "abc"); err != nil {
		t.Fatalf("unsent file: %v", err)
	}

	for _, tc := range []struct {
		name string
		err  error
		code string
	}{
		{"no book", exec(nil, conv, "c.txt", "text", 3, "xyz"), notNullViolation},
		{"another book", exec(otherBooks, nil, "c.txt", "text", 3, "xyz"), foreignKeyViolation},
		{"empty name", exec(books, conv, "", "text", 3, "xyz"), checkViolation},
		{"unknown kind", exec(books, conv, "c.zip", "zip", 3, "xyz"), checkViolation},
		{"size differs", exec(books, conv, "c.txt", "text", 4, "xyz"), checkViolation},
		{"same content twice", exec(books, conv, "a2.txt", "text", 3, "abc"), uniqueViolation},
		{"same unsent content", exec(books, nil, "b2.txt", "text", 3, "abc"), uniqueViolation},
	} {
		var pgErr *pgconn.PgError
		if !errors.As(tc.err, &pgErr) || pgErr.Code != tc.code {
			t.Errorf("%s: err = %v, want SQLSTATE %s", tc.name, tc.err, tc.code)
		}
	}

	if _, err := pool.Exec(
		ctx,
		`DELETE FROM assistant_conversation WHERE id = $1`,
		conv,
	); err != nil {
		t.Fatal(err)
	}

	var left int
	if err := pool.QueryRow(
		ctx,
		`SELECT count(*) FROM assistant_conversation_file WHERE books_id = $1`,
		books,
	).Scan(&left); err != nil {
		t.Fatal(err)
	}

	if left != 1 {
		t.Errorf("files after deleting the conversation = %d, want the unsent one", left)
	}
}
