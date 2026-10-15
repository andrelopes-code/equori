package ledger

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
)

// BenchmarkBalanceAt measures N06 on the reference dataset of chapter 8: 75,000
// transactions with 150,000 postings, half of them on the measured account.
func BenchmarkBalanceAt(b *testing.B) {
	f := newLedgerFixture(b)
	_, err := f.pool.Exec(b.Context(), `
		WITH tx AS (
			INSERT INTO ledger_transaction (user_id, date, description, balancing_currency, origin)
			SELECT $1, date '2016-01-01' + (g % 3650), 'seed', 'BRL', 'manual'
			FROM generate_series(1, 75000) g
			RETURNING id, date
		)
		INSERT INTO ledger_posting (user_id, transaction_id, account_id, position, amount, weight, booked_on, status)
		SELECT $1, tx.id, acc.id, acc.pos, acc.sign * 1000, acc.sign * 1000, tx.date, 'cleared'
		FROM tx CROSS JOIN (VALUES ($2::uuid, 0, -1), ($3::uuid, 1, 1)) AS acc(id, pos, sign)`,
		f.userID, f.checking.ID, f.food.ID)
	if err != nil {
		b.Fatal(err)
	}
	for b.Loop() {
		if _, err := f.svc.BalanceAt(b.Context(), f.userID, f.checking.ID, date("2025-12-31"), app.BasisBooked); err != nil {
			b.Fatal(err)
		}
	}
}
