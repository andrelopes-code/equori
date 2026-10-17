package portfolio_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func TestSchemaRejectsInvalidRows(t *testing.T) {
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
		"unknown tax treatment":  `INSERT INTO portfolio_income_event (user_id, transaction_id, account_id, instrument, date, income_type, tax_treatment, gross, withheld, currency) VALUES ($3, gen_random_uuid(), $1, 'BRL', '2026-10-05', 'dividend', 'taxable', 1, 0, 'BRL')`,
		"unknown income type":    `INSERT INTO portfolio_income_event (user_id, transaction_id, account_id, instrument, date, income_type, tax_treatment, gross, withheld, currency) VALUES ($3, gen_random_uuid(), $1, 'BRL', '2026-10-05', 'rent', 'exempt', 1, 0, 'BRL')`,
	}
	for name, sql := range tests {
		t.Run(name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, sql, account, other, user); err == nil {
				t.Fatal("accepted")
			}
		})
	}
}
