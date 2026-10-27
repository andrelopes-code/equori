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
		VALUES ('MXRF11', 'reit', 0, 'Maxi Renda', 'BRL', 'BVMF')`); err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name string
		sql  string
	}{
		{name: "zero value", sql: `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'BRL', '2026-10-30', 0, 'manual', 1)`},
		{name: "priority of another source", sql: `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'BRL', '2026-10-30', 5.5, 'csv', 1)`},
		{name: "source outside the identifier pattern", sql: `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'BRL', '2026-10-30', 5.5, 'BCB', 3)`},
		{name: "same instrument", sql: `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'USD', '2026-10-30', 1, 'manual', 1)`},
		{name: "unknown instrument", sql: `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('PETR4', 'BRL', '2026-10-30', 30, 'manual', 1)`},
		{name: "security without quote currency", sql: `INSERT INTO marketdata_instrument (code, instrument_type, scale, name) VALUES ('PETR4', 'stock', 0, 'Petrobras')`},
		{name: "currency with quote currency", sql: `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency) VALUES ('SEK', 'currency', 2, 'Krona', 'BRL')`},
		{name: "unknown exchange", sql: `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange) VALUES ('AAPL', 'stock', 0, 'Apple', 'USD', 'NASDAQ')`},
		{name: "legacy exchange", sql: `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange) VALUES ('AAPL', 'stock', 0, 'Apple', 'USD', 'B3')`},
		{name: "subtype outside the identifier pattern", sql: `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, subtype) VALUES ('CRIXPTO', 'fixed_income', 2, 'CRI', 'BRL', 'Bad-Value')`},
		{name: "legacy type", sql: `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency) VALUES ('HGLG11', 'fii', 0, 'CSHG', 'BRL')`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, tt.sql); err == nil {
				t.Fatal("accepted")
			}
		})
	}
}

// ADR 025 F1.
func TestSchemaRejectsInvalidFeeds(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	for name, sql := range map[string]string{
		"identifier outside the pattern": `INSERT INTO marketdata_feed (id, enabled) VALUES ('B3', true)`,
		"no state":                       `INSERT INTO marketdata_feed (id) VALUES ('b3_cotahist')`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := pool.Exec(t.Context(), sql); err == nil {
				t.Fatal("accepted")
			}
		})
	}
}

// ADR 026 E3.
func TestSchemaRejectsInvalidExpectations(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	for name, sql := range map[string]string{
		"index outside the pattern":  `INSERT INTO marketdata_index_expectation (index_id, date, rate, survey_date, source) VALUES ('CDI', '2026-12-31', 0.13, '2026-10-23', 'br_focus')`,
		"source outside the pattern": `INSERT INTO marketdata_index_expectation (index_id, date, rate, survey_date, source) VALUES ('cdi', '2026-12-31', 0.13, '2026-10-23', 'Focus')`,
		"rate at -100%":              `INSERT INTO marketdata_index_expectation (index_id, date, rate, survey_date, source) VALUES ('cdi', '2026-12-31', -1, '2026-10-23', 'br_focus')`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := pool.Exec(t.Context(), sql); err == nil {
				t.Fatal("accepted")
			}
		})
	}
}
