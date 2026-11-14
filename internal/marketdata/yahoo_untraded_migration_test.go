package marketdata_test

import (
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// Migration 98 removes the closes that Yahoo repeated on days without a trade (MQ18) and queues
// the history of each instrument again, so the corrected source fills the dates it kept.
func TestYahooUntradedMigrationPurgesRunsAndQueuesHistory(t *testing.T) {
	t.Parallel()

	pool := pgtest.Empty(t)
	ctx := t.Context()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	if err := postgres.MigrateTo(ctx, pool, 97, log); err != nil {
		t.Fatal(err)
	}

	seedUntradedPrices(t, pool)

	if err := postgres.MigrateTo(ctx, pool, 98, log); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name       string
		instrument string
		source     string
		want       int
	}{
		{"run of identical closes", "B5P211", "yahoo_chart", 2},
		{"varying closes", "PETR4", "yahoo_chart", 5},
		{"run from another source", "B5P211", "b3_cotahist", 5},
		{"run entered by a member", "B5P211", "manual", 5},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var got int
			if err := pool.QueryRow(
				ctx,
				`SELECT count(*) FROM marketdata_price WHERE instrument = $1 AND source = $2`,
				tc.instrument,
				tc.source,
			).Scan(&got); err != nil {
				t.Fatal(err)
			}

			if got != tc.want {
				t.Fatalf("%s %s rows = %d, want %d", tc.instrument, tc.source, got, tc.want)
			}
		})
	}

	var (
		from   time.Time
		doneAt *time.Time
		queued int
	)

	if err := pool.QueryRow(
		ctx,
		`SELECT from_date, done_at FROM marketdata_history
		WHERE source = 'yahoo_chart' AND instrument = 'B5P211'`,
	).Scan(&from, &doneAt); err != nil {
		t.Fatal(err)
	}

	if from.Format(time.DateOnly) != "2022-03-07" || doneAt != nil {
		t.Fatalf("history of B5P211 = %s done %v, want 2022-03-07 pending", from, doneAt)
	}

	if err := pool.QueryRow(ctx, `SELECT count(*) FROM marketdata_history`).
		Scan(&queued); err != nil {
		t.Fatal(err)
	}

	if queued != 1 {
		t.Fatalf("queued histories = %d, want 1", queued)
	}
}

// The closes are not purged while yahoo_chart is disabled, because nothing would refill them.
func TestYahooUntradedMigrationKeepsPricesOfDisabledSource(t *testing.T) {
	t.Parallel()

	pool := pgtest.Empty(t)
	ctx := t.Context()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	if err := postgres.MigrateTo(ctx, pool, 97, log); err != nil {
		t.Fatal(err)
	}

	seedUntradedPrices(t, pool)

	if _, err := pool.Exec(
		ctx,
		`UPDATE marketdata_feed SET enabled = false WHERE id = 'yahoo_chart'`,
	); err != nil {
		t.Fatal(err)
	}

	if err := postgres.MigrateTo(ctx, pool, 98, log); err != nil {
		t.Fatal(err)
	}

	var got int
	if err := pool.QueryRow(
		ctx,
		`SELECT count(*) FROM marketdata_price WHERE instrument = 'B5P211' AND source = 'yahoo_chart'`,
	).Scan(&got); err != nil {
		t.Fatal(err)
	}

	if got != 8 {
		t.Fatalf("B5P211 yahoo_chart rows = %d, want 8", got)
	}
}

func seedUntradedPrices(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	ctx := t.Context()

	statements := []string{
		`INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange) VALUES
		('B5P211', 'etf', 2, 'IT NOW IMA-B5 P2', 'BRL', 'BVMF'),
		('PETR4', 'stock', 2, 'Petrobras', 'BRL', 'BVMF')`,
		`INSERT INTO marketdata_feed (id, enabled) VALUES ('yahoo_chart', true)
		ON CONFLICT (id) DO UPDATE SET enabled = true`,
		// Six identical closes, then two others: the run is purged and the two others stay.
		`INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority)
		SELECT 'B5P211', 'BRL', d, 71.25, 'yahoo_chart', 3
		FROM generate_series('2022-03-07'::date, '2022-03-14'::date, '1 day') d
		WHERE extract(isodow FROM d) < 6`,
		`INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES
		('B5P211', 'BRL', '2026-01-08', 101.92, 'yahoo_chart', 3),
		('B5P211', 'BRL', '2026-01-09', 101.87, 'yahoo_chart', 3)`,
		`INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority)
		SELECT 'PETR4', 'BRL', '2026-01-05'::date + i, 30 + i, 'yahoo_chart', 3 FROM generate_series(0, 4) i`,
		`INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority)
		SELECT 'B5P211', 'BRL', '2026-01-05'::date + i, 100, 'b3_cotahist', 3 FROM generate_series(0, 4) i`,
		`INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority)
		SELECT 'B5P211', 'BRL', '2026-01-05'::date + i, 100, 'manual', 1 FROM generate_series(0, 4) i`,
	}

	for _, s := range statements {
		if _, err := pool.Exec(ctx, s); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
}
