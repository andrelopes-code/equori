package marketdata_test

import (
	"io"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// Migration 114 removes the rows that yahoo_chart and coinbase stored before their day ended
// (A248 CQ4) and queues the history of each instrument from its earliest such date.
func TestFinishedClosesMigrationPurgesRunningBarsAndQueuesHistory(t *testing.T) {
	t.Parallel()

	pool := pgtest.Empty(t)
	ctx := t.Context()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	if err := postgres.MigrateTo(ctx, pool, 113, log); err != nil {
		t.Fatal(err)
	}

	seedRunningCloses(t, pool, true)

	if err := postgres.MigrateTo(ctx, pool, 114, log); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name       string
		source     string
		instrument string
		date       string
		want       int
	}{
		{"before the day ended", "yahoo_chart", "NVDA", "2026-11-10", 1},
		{"recorded during its day", "yahoo_chart", "NVDA", "2026-11-11", 0},
		{"sound row after the first suspect date", "yahoo_chart", "NVDA", "2026-11-12", 0},
		{"exactly 36 hours after the date", "coinbase", "BTC", "2026-11-10", 1},
		{"coinbase recorded during its day", "coinbase", "BTC", "2026-11-11", 0},
		{"another source", "b3_cotahist", "NVDA", "2026-11-11", 1},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var got int
			if err := pool.QueryRow(
				ctx,
				`SELECT count(*) FROM marketdata_price
				WHERE source = $1 AND instrument = $2 AND date = $3::date`,
				tc.source,
				tc.instrument,
				tc.date,
			).Scan(&got); err != nil {
				t.Fatal(err)
			}

			if got != tc.want {
				t.Fatalf(
					"%s %s %s rows = %d, want %d",
					tc.source,
					tc.instrument,
					tc.date,
					got,
					tc.want,
				)
			}
		})
	}

	got := queuedHistories(t, pool)
	want := []string{"coinbase BTC 2026-11-11 false", "yahoo_chart NVDA 2026-11-11 false"}

	assertRows(t, got, want...)
}

// The rows are not purged while their source is disabled, because nothing would refill them.
func TestFinishedClosesMigrationKeepsPricesOfDisabledSource(t *testing.T) {
	t.Parallel()

	pool := pgtest.Empty(t)
	ctx := t.Context()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	if err := postgres.MigrateTo(ctx, pool, 113, log); err != nil {
		t.Fatal(err)
	}

	seedRunningCloses(t, pool, false)

	if err := postgres.MigrateTo(ctx, pool, 114, log); err != nil {
		t.Fatal(err)
	}

	var got int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM marketdata_price`).Scan(&got); err != nil {
		t.Fatal(err)
	}

	if got != 6 {
		t.Fatalf("price rows = %d, want 6", got)
	}

	assertRows(t, queuedHistories(t, pool))
}

func seedRunningCloses(t *testing.T, pool *pgxpool.Pool, enabled bool) {
	t.Helper()

	ctx := t.Context()

	statements := []string{
		`INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange) VALUES
		('NVDA', 'stock', 0, 'NVIDIA', 'USD', 'XNAS'),
		('BTC', 'crypto', 8, 'Bitcoin', 'USD', NULL)`,
		`INSERT INTO marketdata_price
			(instrument, quote_instrument, date, value, source, priority, recorded_at) VALUES
		('NVDA', 'USD', '2026-11-10', 100, 'yahoo_chart', 3, '2026-11-11 14:00+00'),
		('NVDA', 'USD', '2026-11-11', 101, 'yahoo_chart', 3, '2026-11-11 15:22+00'),
		('NVDA', 'USD', '2026-11-12', 102, 'yahoo_chart', 3, '2026-11-13 14:00+00'),
		('BTC', 'USD', '2026-11-10', 90000, 'coinbase', 3, '2026-11-12 00:00+00'),
		('BTC', 'USD', '2026-11-11', 91000, 'coinbase', 3, '2026-11-11 23:57+00'),
		('NVDA', 'USD', '2026-11-11', 101, 'b3_cotahist', 3, '2026-11-11 15:22+00')`,
	}

	for _, s := range statements {
		if _, err := pool.Exec(ctx, s); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}

	for _, id := range []string{"yahoo_chart", "coinbase"} {
		if _, err := pool.Exec(
			ctx,
			`INSERT INTO marketdata_feed (id, enabled) VALUES ($1, $2)
			ON CONFLICT (id) DO UPDATE SET enabled = $2`,
			id,
			enabled,
		); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
}

func queuedHistories(t *testing.T, pool *pgxpool.Pool) []string {
	t.Helper()

	rows, err := pool.Query(
		t.Context(),
		`SELECT source || ' ' || instrument || ' ' || from_date::text || ' ' ||
			(done_at IS NOT NULL)::text
		FROM marketdata_history ORDER BY source`,
	)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	var out []string

	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}

		out = append(out, s)
	}

	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}

	return out
}
