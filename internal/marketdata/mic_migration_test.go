package marketdata_test

import (
	"io"
	"log/slog"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// Spec 5.4: migration 44 renames the exchange B3 to its MIC and the Brazilian instrument types to the universal ones.
func TestMicMigrationConvertsInstruments(t *testing.T) {
	t.Parallel()
	pool := pgtest.Empty(t)
	ctx := t.Context()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	if err := postgres.MigrateTo(ctx, pool, 43, log); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange) VALUES
		('MXRF11', 'fii', 0, 'Maxi Renda', 'BRL', 'B3'),
		('AAPL34', 'bdr', 0, 'Apple BDR', 'BRL', 'B3'),
		('PETR4', 'stock', 0, 'Petrobras', 'BRL', NULL)`); err != nil {
		t.Fatal(err)
	}
	if err := postgres.MigrateTo(ctx, pool, 44, log); err != nil {
		t.Fatal(err)
	}
	want := map[string][2]string{"MXRF11": {"reit", "BVMF"}, "AAPL34": {"depositary_receipt", "BVMF"}, "PETR4": {"stock", ""}}
	for code, w := range want {
		var typ, exchange string
		if err := pool.QueryRow(ctx, `SELECT instrument_type, coalesce(exchange, '') FROM marketdata_instrument WHERE code = $1`, code).Scan(&typ, &exchange); err != nil {
			t.Fatal(err)
		}
		if [2]string{typ, exchange} != w {
			t.Fatalf("%s = %q %q, want %v", code, typ, exchange, w)
		}
	}
}
