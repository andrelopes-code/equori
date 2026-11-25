package portfolio_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// CO1, CO7, CO8, CO15: the condition columns reject a value outside their set.
func TestSchemaRejectsInvalidContributionConditions(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	user := pgtest.CreateBooks(t, pool)

	tests := map[string]string{
		"effect block": withClass + `INSERT INTO portfolio_contribution_question
			(books_id, class_id, position, text, effect) SELECT books_id, id, 0, 'Q', 'block' FROM c`,
		"review of 2 months": withClass + `INSERT INTO portfolio_contribution_question
			(books_id, class_id, position, text, review_months) SELECT books_id, id, 0, 'Q', 2 FROM c`,
		"release on the second": withClass + `INSERT INTO portfolio_contribution_member
			(books_id, class_id, position, instrument, release_month)
			SELECT books_id, id, 0, 'BRL', '2026-11-02' FROM c`,
		"revision 0": `INSERT INTO portfolio_contribution_plan (books_id, revision)
			SELECT $3::bigint, 0 WHERE $1::uuid IS NOT NULL AND $2::bigint IS NOT NULL`,
	}
	for name, sql := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := pool.Exec(ctx, sql, "00000000-0000-0000-0000-000000000000", int64(0), user)

			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || !strings.HasPrefix(pgErr.Code, "23") {
				t.Fatalf("want an integrity constraint violation, got %v", err)
			}
		})
	}
}
