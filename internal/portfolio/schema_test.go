package portfolio_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func TestSchemaRejectsInvalidRows(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	user := pgtest.CreateUser(t, pool)
	other := pgtest.CreateUser(t, pool)
	var account string
	if err := pool.QueryRow(ctx, `INSERT INTO ledger_account (user_id, name, account_class, kind, instrument, opened_on)
		VALUES ($1, 'XP', 'asset', 'brokerage', 'BRL', '2026-01-01') RETURNING id`, user).Scan(&account); err != nil {
		t.Fatal(err)
	}
	tests := map[string]string{
		"another user's account": `INSERT INTO portfolio_position_day (user_id, account_id, instrument, date, quantity, cost_basis) VALUES ($2, $1, 'BRL', '2026-10-05', 1, 1)`,
		"unknown tax treatment":  `INSERT INTO portfolio_income_event (user_id, transaction_id, account_id, instrument, date, income_type, tax_treatment, gross, withheld, currency) VALUES ($3, gen_random_uuid(), $1, 'BRL', '2026-10-05', 'dividend', 'Taxable!', 1, 0, 'BRL')`,
		"malformed income type":  `INSERT INTO portfolio_income_event (user_id, transaction_id, account_id, instrument, date, income_type, tax_treatment, gross, withheld, currency) VALUES ($3, gen_random_uuid(), $1, 'BRL', '2026-10-05', 'Bad!', 'exempt', 1, 0, 'BRL')`,
		"malformed tax class":    `INSERT INTO portfolio_realized_result (user_id, transaction_id, account_id, instrument, date, month, quantity, cost, proceeds, result, tax_class, currency) VALUES ($3, gen_random_uuid(), $1, 'BRL', '2026-10-05', '2026-10-01', 1, 1, 1, 0, 'Bad!', 'BRL')`,
	}
	for name, sql := range tests {
		t.Run(name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, sql, account, other, user); err == nil {
				t.Fatal("accepted")
			}
		})
	}
}

func TestSchemaAcceptsOpenIncomeTypesAndNullTax(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	user := pgtest.CreateUser(t, pool)
	var account string
	if err := pool.QueryRow(ctx, `INSERT INTO ledger_account (user_id, name, account_class, kind, instrument, opened_on)
		VALUES ($1, 'XP', 'asset', 'brokerage', 'BRL', '2026-01-01') RETURNING id`, user).Scan(&account); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO portfolio_income_event (user_id, transaction_id, account_id, instrument, date, income_type, tax_treatment, gross, withheld, currency) VALUES ($2, gen_random_uuid(), $1, 'BRL', '2026-10-05', 'rent', NULL, 1, 0, 'BRL')`, account, user); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO portfolio_realized_result (user_id, transaction_id, account_id, instrument, date, month, quantity, cost, proceeds, result, tax_class, currency) VALUES ($2, gen_random_uuid(), $1, 'BRL', '2026-10-05', '2026-10-01', 1, 1, 1, 0, NULL, 'BRL')`, account, user); err != nil {
		t.Fatal(err)
	}
}
