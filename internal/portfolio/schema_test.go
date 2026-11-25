package portfolio_test

import (
	"errors"
	"maps"
	"slices"
	"strconv"
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
		"second rebuild state":   `INSERT INTO portfolio_rebuild_state (version) VALUES ('a'), ('b')`,
		"rebuild state id false": `INSERT INTO portfolio_rebuild_state (id, version) VALUES (false, 'a')`,
		"empty rebuild version":  `INSERT INTO portfolio_rebuild_state (version) VALUES ('')`,
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

	validFacts := withMember + `INSERT INTO portfolio_contribution_question
		(books_id, class_id, position, text, fact, limit_value)
		SELECT books_id, id, 0, 'Q', 'piotroski_p1', NULL::numeric FROM c
		UNION ALL SELECT books_id, id, 1, 'R', NULL, NULL FROM c
		UNION ALL SELECT books_id, id, 2, 'S', NULL, NULL FROM c
		UNION ALL SELECT books_id, id, 19, 'T', 'roe_min', 0.12 FROM c`
	if _, err := pool.Exec(ctx, validFacts, pgtest.CreateBooks(t, pool)); err != nil {
		t.Fatalf("valid fact rows: %v", err)
	}

	tests := map[string]string{
		"question of 201 characters": withMember + `INSERT INTO portfolio_contribution_question
			(books_id, class_id, position, text) SELECT books_id, id, 0, repeat('x', 201) FROM c`,
		"question at position 20": withMember + `INSERT INTO portfolio_contribution_question
			(books_id, class_id, position, text) SELECT books_id, id, 20, 'Q' FROM c`,
		"limit without a fact": withMember + `INSERT INTO portfolio_contribution_question
			(books_id, class_id, position, text, limit_value)
			SELECT books_id, id, 0, 'Q', 1 FROM c`,
		"answer of a member position that does not exist": withQuestion + `INSERT INTO portfolio_contribution_answer
			(books_id, class_id, question_position, member_position, yes)
			SELECT books_id, id, 0, 5, true FROM c WHERE EXISTS (SELECT 1 FROM q)`,
		"question without a class": `INSERT INTO portfolio_contribution_question
			(books_id, class_id, position, text) SELECT $1::bigint, gen_random_uuid(), 0, 'Q'`,
		"question with a fact of the wrong form": withMember + `INSERT INTO portfolio_contribution_question
			(books_id, class_id, position, text, fact) SELECT books_id, id, 0, 'Q', 'P1' FROM c`,
		"two questions with one fact": withMember + `INSERT INTO portfolio_contribution_question
			(books_id, class_id, position, text, fact)
			SELECT books_id, id, 0, 'Q', 'piotroski_p1' FROM c
			UNION ALL SELECT books_id, id, 1, 'R', 'piotroski_p1' FROM c`,
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

// withRule adds the rule at position 0 of the class of withMember; columns names the conditions
// that the rule sets and values holds their values.
func withRule(columns, values string) string {
	return withMember + `INSERT INTO portfolio_contribution_rule
		(books_id, class_id, position, ` + columns + `) SELECT books_id, id, 0, ` + values + ` FROM c`
}

func TestSchemaRejectsInvalidContributionRules(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	user := pgtest.CreateBooks(t, pool)
	control := pgtest.CreateBooks(t, pool)

	// The statements that the cases below break in one place accept the valid row.
	valid := withRule("return_kind, matures_from_year, matures_to_year", "'rate', 2030, 2035")
	if _, err := pool.Exec(ctx, valid, control); err != nil {
		t.Fatalf("valid row: %v", err)
	}

	tests := map[string]string{
		"rule without books_id": withMember + `INSERT INTO portfolio_contribution_rule
			(books_id, class_id, position, return_kind) SELECT NULL, id, 0, 'rate' FROM c`,
		"rule with every condition null": withRule("instrument_type", "NULL"),
		"rule from 2035 to 2030": withRule(
			"matures_from_year, matures_to_year",
			"2035, 2030",
		),
		"rule at position 5": withMember + `INSERT INTO portfolio_contribution_rule
			(books_id, class_id, position, return_kind) SELECT books_id, id, 5, 'rate' FROM c`,
		"rule of an unknown return kind":      withRule("return_kind", "'float'"),
		"rule of a malformed instrument type": withRule("instrument_type", "'Fixed'"),
		"rule of an empty subtypes list":      withRule("subtypes", "ARRAY[]::text[]"),
		"rule of an unknown guarantee":        withRule("guarantee", "'fgc'"),
		"rule of a year before 1900":          withRule("matures_from_year", "1899"),
		"rule without a class": `INSERT INTO portfolio_contribution_rule
			(books_id, class_id, position, return_kind)
			SELECT $1::bigint, gen_random_uuid(), 0, 'rate'`,
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

// planInsert inserts a plan for a book and a member; override replaces the value of a column.
func planInsert(books, member int64, override map[string]string) string {
	values := map[string]string{
		"books_id":           strconv.FormatInt(books, 10),
		"member_id":          strconv.FormatInt(member, 10),
		"withdrawal_age":     "60",
		"last_age":           "95",
		"real_return_bp":     "400",
		"inflation_bp":       "300",
		"withdrawal_mode":    "'income'",
		"income":             "1000",
		"withdrawal_rate_bp": "NULL",
		"currency":           "'BRL'",
		"baseline_date":      "'2026-11-01'",
		"baseline_value":     "0",
	}
	maps.Copy(values, override)

	columns := slices.Sorted(maps.Keys(values))
	row := make([]string, len(columns))
	for i, c := range columns {
		row[i] = values[c]
	}

	return `INSERT INTO portfolio_projection_plan (` + strings.Join(columns, ", ") +
		`) VALUES (` + strings.Join(row, ", ") + `)`
}

func TestSchemaRejectsInvalidProjectionPlans(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	member, user := pgtest.CreateMember(t, pool)
	controlMember, control := pgtest.CreateMember(t, pool)

	// The statements that the cases below break in one place accept the valid rows.
	for name, override := range map[string]map[string]string{
		"income mode": nil,
		"rate mode": {
			"withdrawal_mode": "'rate'", "income": "NULL", "withdrawal_rate_bp": "400",
		},
		"limits": {
			"withdrawal_age": "18", "last_age": "120", "real_return_bp": "-1000", "inflation_bp": "5000",
		},
		"premises": {
			"withdrawal_return_bp": "-1000", "cautious_return_bp": "399",
			"favorable_return_bp": "401", "gain_tax_bp": "5000",
		},
	} {
		other, books := pgtest.CreateMember(t, pool)
		if _, err := pool.Exec(ctx, planInsert(books, other, override)); err != nil {
			t.Fatalf("valid %s: %v", name, err)
		}
	}

	tests := map[string]map[string]string{
		"withdrawal age 17":         {"withdrawal_age": "17"},
		"withdrawal age 101":        {"withdrawal_age": "101"},
		"last age 121":              {"last_age": "121"},
		"last age equal to start":   {"last_age": "60"},
		"last age below start":      {"last_age": "59"},
		"real return -1001":         {"real_return_bp": "-1001"},
		"real return 3001":          {"real_return_bp": "3001"},
		"inflation -1":              {"inflation_bp": "-1"},
		"inflation 5001":            {"inflation_bp": "5001"},
		"withdrawal return -1001":   {"withdrawal_return_bp": "-1001"},
		"withdrawal return 3001":    {"withdrawal_return_bp": "3001"},
		"cautious -1001":            {"cautious_return_bp": "-1001"},
		"cautious equal to plan":    {"cautious_return_bp": "400"},
		"favorable equal to plan":   {"favorable_return_bp": "400"},
		"favorable 3001":            {"favorable_return_bp": "3001"},
		"gain tax 0":                {"gain_tax_bp": "0"},
		"gain tax 5001":             {"gain_tax_bp": "5001"},
		"unknown mode":              {"withdrawal_mode": "'amount'"},
		"income mode without value": {"income": "NULL"},
		"income mode with a rate":   {"withdrawal_rate_bp": "400"},
		"income zero":               {"income": "0"},
		"rate mode without value": {
			"withdrawal_mode": "'rate'", "income": "NULL",
		},
		"rate mode with an income": {
			"withdrawal_mode": "'rate'", "withdrawal_rate_bp": "400",
		},
		"rate zero": {
			"withdrawal_mode": "'rate'", "income": "NULL", "withdrawal_rate_bp": "0",
		},
		"rate 2001": {
			"withdrawal_mode": "'rate'", "income": "NULL", "withdrawal_rate_bp": "2001",
		},
		"unknown currency":    {"currency": "'ZZZ'"},
		"missing currency":    {"currency": "NULL"},
		"missing baseline":    {"baseline_date": "NULL"},
		"missing base value":  {"baseline_value": "NULL"},
		"row without a book":  {"books_id": "NULL"},
		"book not existing":   {"books_id": "0"},
		"row without member":  {"member_id": "NULL"},
		"member not existing": {"member_id": "0"},
	}
	for name, override := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := pool.Exec(ctx, planInsert(user, member, override))

			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || !strings.HasPrefix(pgErr.Code, "23") {
				t.Fatalf("want an integrity constraint violation, got %v", err)
			}
		})
	}

	t.Run("second plan of one member", func(t *testing.T) {
		if _, err := pool.Exec(ctx, planInsert(control, controlMember, nil)); err != nil {
			t.Fatal(err)
		}

		_, err := pool.Exec(ctx, planInsert(control, controlMember, nil))

		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
			t.Fatalf("want a unique violation, got %v", err)
		}
	})
}

func TestSchemaRejectsInvalidProjectionChanges(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	member, user := pgtest.CreateMember(t, pool)
	stranger, _ := pgtest.CreateMember(t, pool)

	if _, err := pool.Exec(ctx, planInsert(user, member, nil)); err != nil {
		t.Fatal(err)
	}

	book, owner := strconv.FormatInt(user, 10), strconv.FormatInt(member, 10)
	insert := `INSERT INTO portfolio_projection_change (books_id, member_id, month, amount) VALUES `
	valid := insert + `(` + book + `, ` + owner + `, '2026-11-01', 0), (` +
		book + `, ` + owner + `, '2026-12-01', 500)`
	if _, err := pool.Exec(ctx, valid); err != nil {
		t.Fatalf("valid rows: %v", err)
	}

	tests := map[string]string{
		"month on day 2":     insert + `(` + book + `, ` + owner + `, '2027-01-02', 1)`,
		"amount -1":          insert + `(` + book + `, ` + owner + `, '2027-01-01', -1)`,
		"month twice":        insert + `(` + book + `, ` + owner + `, '2026-11-01', 1)`,
		"month missing":      insert + `(` + book + `, ` + owner + `, NULL, 1)`,
		"amount missing":     insert + `(` + book + `, ` + owner + `, '2027-01-01', NULL)`,
		"row without a book": insert + `(NULL, ` + owner + `, '2027-01-01', 1)`,
		"change without a plan": insert + `(` + book + `, ` + strconv.FormatInt(
			stranger,
			10,
		) + `, '2027-01-01', 1)`,
		"change of another book": insert + `(0, ` + owner + `, '2027-01-01', 1)`,
	}
	for name, sql := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := pool.Exec(ctx, sql)

			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || !strings.HasPrefix(pgErr.Code, "23") {
				t.Fatalf("want an integrity constraint violation, got %v", err)
			}
		})
	}
}

func TestSchemaRejectsInvalidProjectionIncomes(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	member, user := pgtest.CreateMember(t, pool)
	stranger, _ := pgtest.CreateMember(t, pool)

	if _, err := pool.Exec(ctx, planInsert(user, member, nil)); err != nil {
		t.Fatal(err)
	}

	book, owner := strconv.FormatInt(user, 10), strconv.FormatInt(member, 10)
	insert := `INSERT INTO portfolio_projection_income
		(books_id, member_id, position, name, amount, start_age, end_age) VALUES `
	key := book + `, ` + owner + `, `
	valid := insert + `(` + key + `1, 'a', 1, 18, 19), (` + key + `20, 'b', 1, 120, NULL)`

	if _, err := pool.Exec(ctx, valid); err != nil {
		t.Fatalf("valid rows: %v", err)
	}

	tests := map[string]string{
		"position 0":         insert + `(` + key + `0, 'a', 1, 65, NULL)`,
		"position 21":        insert + `(` + key + `21, 'a', 1, 65, NULL)`,
		"position twice":     insert + `(` + key + `1, 'a', 1, 65, NULL)`,
		"name empty":         insert + `(` + key + `2, '', 1, 65, NULL)`,
		"name of 61":         insert + `(` + key + `2, repeat('a', 61), 1, 65, NULL)`,
		"amount 0":           insert + `(` + key + `2, 'a', 0, 65, NULL)`,
		"start 17":           insert + `(` + key + `2, 'a', 1, 17, NULL)`,
		"start 121":          insert + `(` + key + `2, 'a', 1, 121, NULL)`,
		"end equal to start": insert + `(` + key + `2, 'a', 1, 65, 65)`,
		"end 121":            insert + `(` + key + `2, 'a', 1, 65, 121)`,
		"row without a book": insert + `(NULL, ` + owner + `, 2, 'a', 1, 65, NULL)`,
		"income without a plan": insert + `(` + book + `, ` + strconv.FormatInt(
			stranger,
			10,
		) + `, 2, 'a', 1, 65, NULL)`,
		"income of another book": insert + `(0, ` + owner + `, 2, 'a', 1, 65, NULL)`,
	}
	for name, sql := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := pool.Exec(ctx, sql)

			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || !strings.HasPrefix(pgErr.Code, "23") {
				t.Fatalf("want an integrity constraint violation, got %v", err)
			}
		})
	}

	if _, err := pool.Exec(ctx, `DELETE FROM portfolio_projection_plan`); err != nil {
		t.Fatal(err)
	}

	var left int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM portfolio_projection_income`).
		Scan(&left); err != nil {
		t.Fatal(err)
	}

	if left != 0 {
		t.Errorf("incomes after the plan is deleted = %d, want 0", left)
	}
}

func TestSchemaCascadesProjectionPlan(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	kept, keptBooks := pgtest.CreateMember(t, pool)
	removed, removedBooks := pgtest.CreateMember(t, pool)

	for _, p := range [][2]int64{{keptBooks, kept}, {removedBooks, removed}} {
		if _, err := pool.Exec(ctx, planInsert(p[0], p[1], nil)); err != nil {
			t.Fatal(err)
		}

		if _, err := pool.Exec(ctx, `INSERT INTO portfolio_projection_change
			(books_id, member_id, month, amount) VALUES ($1, $2, '2026-11-01', 1)`, p[0], p[1]); err != nil {
			t.Fatal(err)
		}
	}

	if _, err := pool.Exec(ctx, `DELETE FROM identity_member WHERE id = $1`, removed); err != nil {
		t.Fatal(err)
	}

	for table, want := range map[string]int{
		"portfolio_projection_plan":   1,
		"portfolio_projection_change": 1,
	} {
		var got int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM `+table).Scan(&got); err != nil {
			t.Fatal(err)
		}

		if got != want {
			t.Errorf("%s rows = %d, want %d", table, got, want)
		}
	}

	if _, err := pool.Exec(ctx, `DELETE FROM portfolio_projection_plan`); err != nil {
		t.Fatal(err)
	}

	var changes int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM portfolio_projection_change`).
		Scan(&changes); err != nil {
		t.Fatal(err)
	}

	if changes != 0 {
		t.Errorf("changes after the plan is deleted = %d, want 0", changes)
	}
}

func TestSchemaRejectsBirthDateBefore1900(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	member, _ := pgtest.CreateMember(t, pool)

	if _, err := pool.Exec(
		ctx,
		`UPDATE identity_member SET birth_date = '1900-01-01' WHERE id = $1`,
		member,
	); err != nil {
		t.Fatalf("valid birth date: %v", err)
	}

	_, err := pool.Exec(
		ctx,
		`UPDATE identity_member SET birth_date = '1899-12-31' WHERE id = $1`,
		member,
	)

	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23514" {
		t.Fatalf("want a check violation, got %v", err)
	}
}
