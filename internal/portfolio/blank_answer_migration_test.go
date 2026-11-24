package portfolio_test

import (
	"io"
	"log/slog"
	"reflect"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// Migration 146 turns blank a stored no to a question with a fact and keeps every other answer (CQ2).
func TestBlankAnswerMigration(t *testing.T) {
	t.Parallel()

	pool := pgtest.Empty(t)
	ctx := t.Context()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	if err := postgres.MigrateTo(ctx, pool, 145, log); err != nil {
		t.Fatal(err)
	}

	book := pgtest.CreateBooks(t, pool)

	_, err := pool.Exec(ctx, withMember+`, q AS (INSERT INTO portfolio_contribution_question
			(books_id, class_id, position, text, fact)
			SELECT $1, class_id, p, 'Q' || p, f FROM m, (VALUES (0, 'piotroski_p1'),
				(1, 'piotroski_p2'), (2, NULL)) AS v (p, f) RETURNING class_id, position)
		INSERT INTO portfolio_contribution_answer
			(books_id, class_id, question_position, member_position, yes)
		SELECT $1, class_id, position, 0, position = 1 FROM q`, book)
	if err != nil {
		t.Fatal(err)
	}

	if err := postgres.MigrateTo(ctx, pool, 146, log); err != nil {
		t.Fatal(err)
	}

	rows, err := pool.Query(
		ctx,
		`SELECT coalesce(yes::text, 'blank') FROM portfolio_contribution_answer
		ORDER BY question_position`,
	)
	if err != nil {
		t.Fatal(err)
	}

	got, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatal(err)
	}

	if want := []string{"blank", "true", "false"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("answers = %v, want %v", got, want)
	}
}
