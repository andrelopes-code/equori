package reporting_test

import (
	"io"
	"log/slog"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
	"github.com/andrelopes-code/equori/internal/server"
)

// BenchmarkRebuildAll measures N08 on the reference dataset of chapter 8:
// 75,000 transactions, 150,000 postings over 10 years.
func BenchmarkRebuildAll(b *testing.B) {
	pool := pgtest.New(b)
	userID := pgtest.CreateUser(b, pool)
	var checking, food string
	for _, a := range []struct {
		dst         *string
		class, kind string
	}{{&checking, "asset", "checking"}, {&food, "expense", ""}} {
		err := pool.QueryRow(b.Context(), `
			INSERT INTO ledger_account (user_id, name, account_class, kind, instrument, opened_on)
			VALUES ($1, $2, $2, nullif($3, ''), 'BRL', '1900-01-01') RETURNING id`, userID, a.class, a.kind).Scan(a.dst)
		if err != nil {
			b.Fatal(err)
		}
	}
	_, err := pool.Exec(b.Context(), `
		WITH tx AS (
			INSERT INTO ledger_transaction (user_id, date, description, balancing_currency, origin)
			SELECT $1, date '2016-01-01' + (g % 3650), 'seed', 'BRL', 'manual'
			FROM generate_series(1, 75000) g
			RETURNING id, date
		)
		INSERT INTO ledger_posting (user_id, transaction_id, account_id, position, amount, weight, booked_on, status)
		SELECT $1, tx.id, acc.id, acc.pos, acc.sign * 1000, acc.sign * 1000, tx.date, 'cleared'
		FROM tx CROSS JOIN (VALUES ($2::uuid, 0, -1), ($3::uuid, 1, 1)) AS acc(id, pos, sign)`,
		userID, checking, food)
	if err != nil {
		b.Fatal(err)
	}
	app, err := server.New(pool, server.Config{}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		b.Fatal(err)
	}
	for b.Loop() {
		if err := app.Reporting.RebuildAll(b.Context()); err != nil {
			b.Fatal(err)
		}
	}
}
