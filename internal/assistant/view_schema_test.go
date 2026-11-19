package assistant_test

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// B1 of the answer views design: a view belongs to a book, a conversation and a message of that book.
func TestViewSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	ma, a := pgtest.CreateMember(t, pool)
	b := pgtest.CreateBooks(t, pool)

	const conv = "22222222-2222-2222-2222-222222222222"
	if _, err := pool.Exec(
		ctx,
		`INSERT INTO assistant_conversation (id, books_id, member_id, title, created_at, updated_at)
		VALUES ($1, $2, $3, 'T', now(), now())`,
		conv,
		a,
		ma,
	); err != nil {
		t.Fatal(err)
	}

	const msg = "33333333-3333-3333-3333-333333333333"
	if _, err := pool.Exec(
		ctx,
		`INSERT INTO assistant_message VALUES ($1, $2, $3, 1, 'assistant', 'ok', 'answered', now())`,
		msg,
		a,
		conv,
	); err != nil {
		t.Fatal(err)
	}

	insert := `INSERT INTO assistant_view (id, books_id, conversation_id, message_id, seq, form, payload, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, '{}', now())`

	cases := []struct {
		name  string
		books any
		seq   int
		form  string
		code  string
	}{
		{"stored", a, 0, "ranking", ""},
		{"no book", nil, 1, "ranking", "23502"},
		{"other book", b, 1, "ranking", foreignKeyViolation},
		{"form pattern", a, 1, "Ranking", checkViolation},
		{"fourth view", a, 3, "ranking", checkViolation},
		{"same seq", a, 0, "compare", "23505"},
	}

	for _, c := range cases {
		_, err := pool.Exec(ctx, insert, c.books, conv, msg, c.seq, c.form)

		var pgErr *pgconn.PgError
		switch {
		case c.code == "" && err != nil:
			t.Errorf("%s: %v", c.name, err)
		case c.code != "" && (!errors.As(err, &pgErr) || pgErr.Code != c.code):
			t.Errorf("%s: err = %v, want code %s", c.name, err, c.code)
		}
	}
}
