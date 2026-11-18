package portfolio_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// withPlan stores a plan for book $3; it names $1 and $2 so that the statement takes all three
// arguments.
const withPlan = `WITH p AS (INSERT INTO portfolio_contribution_plan (books_id)
	SELECT $3::bigint WHERE $1::uuid IS NOT NULL AND $2::bigint IS NOT NULL RETURNING books_id) `

// withClass adds one class to the plan of withPlan and exposes its id and book as c.
const withClass = withPlan + `, c AS (INSERT INTO portfolio_contribution_class
	(books_id, position, name, target_bp) SELECT books_id, 0, 'Stocks', 10000 FROM p
	RETURNING id, books_id) `

func TestSchemaRejectsInvalidRows(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	user := pgtest.CreateBooks(t, pool)
	other := pgtest.CreateBooks(t, pool)

	var account string
	if err := pool.QueryRow(ctx, `INSERT INTO ledger_account (books_id, name, account_class, kind, instrument, opened_on)
		VALUES ($1, 'XP', 'asset', 'brokerage', 'BRL', '2026-01-01') RETURNING id`, user).
		Scan(&account); err != nil {
		t.Fatal(err)
	}

	tests := map[string]string{
		"another book's account": `INSERT INTO portfolio_position_day (books_id, account_id, instrument, date, quantity, cost_basis) VALUES ($2, $1, 'BRL', '2026-10-05', 1, 1)`,
		"unknown tax treatment":  `INSERT INTO portfolio_income_event (books_id, transaction_id, account_id, instrument, date, income_type, tax_treatment, gross, withheld, currency) VALUES ($3, gen_random_uuid(), $1, 'BRL', '2026-10-05', 'dividend', 'Taxable!', 1, 0, 'BRL')`,
		"malformed income type":  `INSERT INTO portfolio_income_event (books_id, transaction_id, account_id, instrument, date, income_type, tax_treatment, gross, withheld, currency) VALUES ($3, gen_random_uuid(), $1, 'BRL', '2026-10-05', 'Bad!', 'exempt', 1, 0, 'BRL')`,
		"malformed tax class":    `INSERT INTO portfolio_realized_result (books_id, transaction_id, account_id, instrument, date, month, quantity, cost, proceeds, result, tax_class, currency) VALUES ($3, gen_random_uuid(), $1, 'BRL', '2026-10-05', '2026-10-01', 1, 1, 1, 0, 'Bad!', 'BRL')`,
	}
	for name, sql := range tests {
		t.Run(name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, sql, account, other, user); err == nil {
				t.Fatal("accepted")
			}
		})
	}
}

func TestSchemaRejectsInvalidContributionRows(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	user := pgtest.CreateBooks(t, pool)
	other := pgtest.CreateBooks(t, pool)

	var account string
	if err := pool.QueryRow(ctx, `INSERT INTO ledger_account (books_id, name, account_class, kind, instrument, opened_on)
		VALUES ($1, 'XP', 'asset', 'brokerage', 'BRL', '2026-01-01') RETURNING id`, user).
		Scan(&account); err != nil {
		t.Fatal(err)
	}

	tests := map[string]string{
		"class of another book's plan":       withPlan + `INSERT INTO portfolio_contribution_class (books_id, position, name, target_bp) SELECT $2::bigint, 0, 'Stocks', 10000 FROM p`,
		"class target above 10000":           withPlan + `INSERT INTO portfolio_contribution_class (books_id, position, name, target_bp) SELECT books_id, 0, 'Stocks', 10001 FROM p`,
		"class position 20":                  withPlan + `INSERT INTO portfolio_contribution_class (books_id, position, name, target_bp) SELECT books_id, 20, 'Stocks', 10000 FROM p`,
		"class name differing in case":       withPlan + `INSERT INTO portfolio_contribution_class (books_id, position, name, target_bp) SELECT books_id, 0, 'Stocks', 5000 FROM p UNION ALL SELECT books_id, 1, 'stocks', 5000 FROM p`,
		"member with account and instrument": withClass + `INSERT INTO portfolio_contribution_member (books_id, class_id, position, account_id, instrument) SELECT books_id, id, 0, $1::uuid, 'BRL' FROM c`,
		"member with neither":                withClass + `INSERT INTO portfolio_contribution_member (books_id, class_id, position) SELECT books_id, id, 0 FROM c`,
		"member of another book's account": `WITH p AS (INSERT INTO portfolio_contribution_plan (books_id) SELECT $2::bigint WHERE $3::bigint IS NOT NULL RETURNING books_id),
			c AS (INSERT INTO portfolio_contribution_class (books_id, position, name, target_bp) SELECT books_id, 0, 'Stocks', 10000 FROM p RETURNING id, books_id)
			INSERT INTO portfolio_contribution_member (books_id, class_id, position, account_id) SELECT books_id, id, 0, $1::uuid FROM c`,
		"same instrument twice":        withClass + `INSERT INTO portfolio_contribution_member (books_id, class_id, position, instrument) SELECT books_id, id, 0, 'BRL' FROM c UNION ALL SELECT books_id, id, 1, 'BRL' FROM c`,
		"plan amount without currency": `INSERT INTO portfolio_contribution_plan (books_id, amount) SELECT $3::bigint, 100 WHERE $1::uuid IS NOT NULL AND $2::bigint IS NOT NULL`,
	}
	for name, sql := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := pool.Exec(ctx, sql, account, other, user)

			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || !strings.HasPrefix(pgErr.Code, "23") {
				t.Fatalf("want an integrity constraint violation, got %v", err)
			}
		})
	}
}

func TestSchemaAcceptsOpenIncomeTypesAndNullTax(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	user := pgtest.CreateBooks(t, pool)

	var account string
	if err := pool.QueryRow(ctx, `INSERT INTO ledger_account (books_id, name, account_class, kind, instrument, opened_on)
		VALUES ($1, 'XP', 'asset', 'brokerage', 'BRL', '2026-01-01') RETURNING id`, user).
		Scan(&account); err != nil {
		t.Fatal(err)
	}

	if _, err := pool.Exec(
		ctx,
		`INSERT INTO portfolio_income_event (books_id, transaction_id, account_id, instrument, date, income_type, tax_treatment, gross, withheld, currency) VALUES ($2, gen_random_uuid(), $1, 'BRL', '2026-10-05', 'rent', NULL, 1, 0, 'BRL')`,
		account,
		user,
	); err != nil {
		t.Fatal(err)
	}

	if _, err := pool.Exec(
		ctx,
		`INSERT INTO portfolio_realized_result (books_id, transaction_id, account_id, instrument, date, month, quantity, cost, proceeds, result, tax_class, currency) VALUES ($2, gen_random_uuid(), $1, 'BRL', '2026-10-05', '2026-10-01', 1, 1, 1, 0, NULL, 'BRL')`,
		account,
		user,
	); err != nil {
		t.Fatal(err)
	}
}

// withMember stores a plan for book $1 with one class and one member at position 0; the member
// and the class are exposed as m and c.
const withMember = `WITH p AS (INSERT INTO portfolio_contribution_plan (books_id) VALUES ($1) RETURNING books_id),
	c AS (INSERT INTO portfolio_contribution_class (books_id, position, name, target_bp)
		SELECT books_id, 0, 'Stocks', 10000 FROM p RETURNING id, books_id),
	m AS (INSERT INTO portfolio_contribution_member (books_id, class_id, position, instrument)
		SELECT books_id, id, 0, 'BRL' FROM c RETURNING class_id) `

// withQuestion adds the question at position 0 of the class of withMember.
const withQuestion = withMember + `, q AS (INSERT INTO portfolio_contribution_question
	(books_id, class_id, position, text) SELECT books_id, id, 0, 'Q' FROM c RETURNING class_id) `

func TestSchemaRejectsInvalidContributionQuestions(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	user := pgtest.CreateBooks(t, pool)
	control := pgtest.CreateBooks(t, pool)

	// The statement that the cases below break in one place accepts the valid rows.
	valid := withQuestion + `INSERT INTO portfolio_contribution_answer
		(books_id, class_id, question_position, member_position, yes)
		SELECT books_id, id, 0, 0, true FROM c WHERE EXISTS (SELECT 1 FROM q) AND EXISTS (SELECT 1 FROM m)`
	if _, err := pool.Exec(ctx, valid, control); err != nil {
		t.Fatalf("valid rows: %v", err)
	}

	tests := map[string]string{
		"question of 201 characters": withMember + `INSERT INTO portfolio_contribution_question
			(books_id, class_id, position, text) SELECT books_id, id, 0, repeat('x', 201) FROM c`,
		"question at position 10": withMember + `INSERT INTO portfolio_contribution_question
			(books_id, class_id, position, text) SELECT books_id, id, 10, 'Q' FROM c`,
		"answer of a member position that does not exist": withQuestion + `INSERT INTO portfolio_contribution_answer
			(books_id, class_id, question_position, member_position, yes)
			SELECT books_id, id, 0, 5, true FROM c WHERE EXISTS (SELECT 1 FROM q)`,
		"question without a class": `INSERT INTO portfolio_contribution_question
			(books_id, class_id, position, text) SELECT $1::bigint, gen_random_uuid(), 0, 'Q'`,
	}
	for name, sql := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := pool.Exec(ctx, sql, user)

			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || !strings.HasPrefix(pgErr.Code, "23") {
				t.Fatalf("want an integrity constraint violation, got %v", err)
			}
		})
	}
}
