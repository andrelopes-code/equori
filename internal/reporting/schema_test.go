package reporting_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// A119: inflow and outflow are not negative and their difference is the booked delta.
func TestAccountDayFlowChecks(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	booksID := pgtest.CreateBooks(t, pool)

	var account string
	if err := pool.QueryRow(t.Context(), `
		INSERT INTO ledger_account (books_id, name, account_class, kind, instrument, opened_on)
		VALUES ($1, 'Nubank', 'asset', 'checking', 'BRL', '2026-01-01') RETURNING id`, booksID).Scan(&account); err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name                   string
		delta, inflow, outflow int64
		constraint             string
	}{
		{"negative inflow", -100, -100, 0, "reporting_account_day_flows_check"},
		{"negative outflow", 100, 0, -100, "reporting_account_day_flows_check"},
		{"difference is not the delta", 100, 300, 100, "reporting_account_day_delta_check"},
	} {
		_, err := pool.Exec(t.Context(), `
			INSERT INTO reporting_account_day (books_id, account_id, date, delta_booked, delta_settled, balance_booked, balance_settled, inflow_booked, outflow_booked)
			VALUES ($1, $2, '2026-10-01', $3, 0, $3, 0, $4, $5)`, booksID, account, tc.delta, tc.inflow, tc.outflow)

		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.Code != "23514" || !strings.Contains(pgErr.ConstraintName, tc.constraint) {
			t.Errorf("%s: err = %v, want check violation of %s", tc.name, err, tc.constraint)
		}
	}
}
