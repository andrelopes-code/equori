package marketdata_test

import (
	"io"
	"log/slog"
	"slices"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// Migration 138 removes the closes of securities that yahoo_chart stored adjusted for later
// splits (MQ18) and queues their history again, so the corrected source refills them unadjusted.
func TestYahooSplitMigrationPurgesSecuritiesAndQueuesHistory(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name    string
		enabled bool
		want    map[string]int
		queued  []string
	}{
		{
			name:    "enabled source",
			enabled: true,
			want: map[string]int{
				"SBSP3 yahoo_chart":  0,
				"SBSP3 b3_cotahist":  3,
				"SBSP3 manual":       1,
				"IVVB11 yahoo_chart": 0,
				"EUR yahoo_chart":    3,
			},
			queued: []string{
				"yahoo_chart IVVB11 2016-11-01 false",
				"yahoo_chart SBSP3 2026-04-27 false",
			},
		},
		{
			// Nothing is removed while the source is disabled, because nothing would refill it.
			name: "disabled source",
			want: map[string]int{"SBSP3 yahoo_chart": 3, "IVVB11 yahoo_chart": 1},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			pool := pgtest.Empty(t)
			ctx := t.Context()
			log := slog.New(slog.NewTextHandler(io.Discard, nil))

			if err := postgres.MigrateTo(ctx, pool, 137, log); err != nil {
				t.Fatal(err)
			}

			seedAdjustedPrices(t, pool, tc.enabled)

			if err := postgres.MigrateTo(ctx, pool, 138, log); err != nil {
				t.Fatal(err)
			}

			for key, want := range tc.want {
				if got := countPrices(t, pool, key); got != want {
					t.Errorf("%s rows = %d, want %d", key, got, want)
				}
			}

			got := queuedHistories(t, pool)
			slices.Sort(got)

			if !slices.Equal(got, tc.queued) {
				t.Errorf("queued histories = %v, want %v", got, tc.queued)
			}
		})
	}
}

func seedAdjustedPrices(t *testing.T, pool *pgxpool.Pool, enabled bool) {
	t.Helper()

	ctx := t.Context()

	statements := []string{
		`INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange)
		VALUES
		('SBSP3', 'stock', 2, 'Sabesp', 'BRL', 'BVMF'),
		('IVVB11', 'etf', 2, 'iShares S&P 500', 'BRL', 'BVMF')`,
		`INSERT INTO marketdata_feed (id, enabled) VALUES ('yahoo_chart', $1)
		ON CONFLICT (id) DO UPDATE SET enabled = $1`,
		`INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority)
		SELECT 'SBSP3', 'BRL', '2026-04-27'::date + i, 33 + i, 'yahoo_chart', 5
		FROM generate_series(0, 2) i`,
		`INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority)
		SELECT 'SBSP3', 'BRL', '2026-04-27'::date + i, 169 + i, 'b3_cotahist', 3
		FROM generate_series(0, 2) i`,
		`INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority)
		VALUES ('SBSP3', 'BRL', '2026-04-27', 170, 'manual', 1),
		('IVVB11', 'BRL', '2016-11-01', 80, 'yahoo_chart', 5)`,
		`INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority)
		SELECT 'EUR', 'USD', '2026-04-27'::date + i, 1.1, 'yahoo_chart', 5 FROM generate_series(0, 2) i`,
	}

	for i, s := range statements {
		var err error
		if i == 1 {
			_, err = pool.Exec(ctx, s, enabled)
		} else {
			_, err = pool.Exec(ctx, s)
		}

		if err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
}

// countPrices counts the rows of key, an instrument and a source separated by a space.
func countPrices(t *testing.T, pool *pgxpool.Pool, key string) int {
	t.Helper()

	var got int
	if err := pool.QueryRow(
		t.Context(),
		`SELECT count(*) FROM marketdata_price
		WHERE instrument || ' ' || source = $1`,
		key,
	).Scan(&got); err != nil {
		t.Fatal(err)
	}

	return got
}
