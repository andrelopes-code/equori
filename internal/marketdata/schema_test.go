package marketdata_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func TestSchemaRejectsInvalidPrices(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	if _, err := pool.Exec(ctx, `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange)
		VALUES ('MXRF11', 'fii', 0, 'Maxi Renda', 'BRL', 'B3')`); err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name string
		sql  string
	}{
		{name: "zero value", sql: `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'BRL', '2026-10-30', 0, 'manual', 1)`},
		{name: "priority of another source", sql: `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'BRL', '2026-10-30', 5.5, 'csv', 1)`},
		{name: "unknown source", sql: `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'BRL', '2026-10-30', 5.5, 'yahoo', 3)`},
		{name: "same instrument", sql: `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'USD', '2026-10-30', 1, 'manual', 1)`},
		{name: "unknown instrument", sql: `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('PETR4', 'BRL', '2026-10-30', 30, 'manual', 1)`},
		{name: "security without quote currency", sql: `INSERT INTO marketdata_instrument (code, instrument_type, scale, name) VALUES ('PETR4', 'stock', 0, 'Petrobras')`},
		{name: "currency with quote currency", sql: `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency) VALUES ('SEK', 'currency', 2, 'Krona', 'BRL')`},
		{name: "unknown exchange", sql: `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange) VALUES ('AAPL', 'stock', 0, 'Apple', 'USD', 'NASDAQ')`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, tt.sql); err == nil {
				t.Fatal("accepted")
			}
		})
	}
}
