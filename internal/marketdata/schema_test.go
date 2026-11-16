package marketdata_test

import (
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func TestSchemaRejectsInvalidPrices(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)

	ctx := t.Context()
	if _, err := pool.Exec(
		ctx,
		`INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange)
		VALUES ('MXRF11', 'reit', 0, 'Maxi Renda', 'BRL', 'BVMF')`,
	); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name string
		sql  string
	}{
		{
			name: "zero value",
			sql:  `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'BRL', '2026-10-30', 0, 'manual', 1)`,
		},
		{
			name: "priority of another source",
			sql:  `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'BRL', '2026-10-30', 5.5, 'csv', 1)`,
		},
		{
			name: "source outside the identifier pattern",
			sql:  `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'BRL', '2026-10-30', 5.5, 'BCB', 3)`,
		},
		{
			name: "manual with priority 3",
			sql:  `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'BRL', '2026-10-30', 5.5, 'manual', 3)`,
		},
		{
			name: "official source with priority 2",
			sql:  `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'BRL', '2026-10-30', 5.5, 'bcb_ptax', 2)`,
		},
		{
			name: "priority 6",
			sql:  `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'BRL', '2026-10-30', 5.5, 'bcb_ptax', 6)`,
		},
		{
			name: "accrual with priority 1",
			sql:  `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'BRL', '2026-10-30', 5.5, 'accrual', 1)`,
		},
		{
			name: "same instrument",
			sql:  `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('USD', 'USD', '2026-10-30', 1, 'manual', 1)`,
		},
		{
			name: "unknown instrument",
			sql:  `INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority) VALUES ('PETR4', 'BRL', '2026-10-30', 30, 'manual', 1)`,
		},
		{
			name: "security without quote currency",
			sql:  `INSERT INTO marketdata_instrument (code, instrument_type, scale, name) VALUES ('PETR4', 'stock', 0, 'Petrobras')`,
		},
		{
			name: "currency with quote currency",
			sql:  `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency) VALUES ('SEK', 'currency', 2, 'Krona', 'BRL')`,
		},
		{
			name: "unknown exchange",
			sql:  `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange) VALUES ('AAPL', 'stock', 0, 'Apple', 'USD', 'NASDAQ')`,
		},
		{
			name: "legacy exchange",
			sql:  `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange) VALUES ('AAPL', 'stock', 0, 'Apple', 'USD', 'B3')`,
		},
		{
			name: "subtype outside the identifier pattern",
			sql:  `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, subtype) VALUES ('CRIXPTO', 'fixed_income', 2, 'CRI', 'BRL', 'Bad-Value')`,
		},
		{
			name: "legacy type",
			sql:  `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency) VALUES ('HGLG11', 'fii', 0, 'CSHG', 'BRL')`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, tt.sql); err == nil {
				t.Fatal("accepted")
			}
		})
	}
}

// A222 MQ4.
func TestSchemaRejectsInvalidHistory(t *testing.T) {
	t.Parallel()

	pool := pgtest.New(t)
	ctx := t.Context()

	if _, err := pool.Exec(
		ctx,
		`INSERT INTO marketdata_history VALUES ('bcb_ptax', 'USD', '2006-01-01', now())`,
	); err != nil {
		t.Fatal(err)
	}

	for name, sql := range map[string]string{
		"source outside the pattern": `INSERT INTO marketdata_history VALUES ('BCB', 'USD', '2006-01-01', now())`,
		"unknown instrument":         `INSERT INTO marketdata_history VALUES ('bcb_ptax', 'ZZZ', '2006-01-01', now())`,
		"no from date":               `INSERT INTO marketdata_history (source, instrument, requested_at) VALUES ('bcb_ptax', 'EUR', now())`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, sql); err == nil {
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

// A237 I5.
func TestSchemaRejectsInvalidInstitutionIndicators(t *testing.T) {
	t.Parallel()

	const row = `INSERT INTO marketdata_institution_indicator ` +
		`(scheme, identifier, source, period, currency, conglomerate_code, conglomerate_name) VALUES `

	pool := pgtest.New(t)
	for name, sql := range map[string]string{
		"scheme outside the pattern": row + `('BR', '18236120', 'br_ifdata', '2026-06-30', 'BRL', 'C1', 'NU')`,
		"empty identifier":           row + `('br_ispb', '', 'br_ifdata', '2026-06-30', 'BRL', 'C1', 'NU')`,
		"source outside the pattern": row + `('br_ispb', '18236120', 'IFData', '2026-06-30', 'BRL', 'C1', 'NU')`,
		"currency in lower case":     row + `('br_ispb', '18236120', 'br_ifdata', '2026-06-30', 'brl', 'C1', 'NU')`,
		"empty conglomerate code":    row + `('br_ispb', '18236120', 'br_ifdata', '2026-06-30', 'BRL', '', 'NU')`,
		"empty conglomerate name":    row + `('br_ispb', '18236120', 'br_ifdata', '2026-06-30', 'BRL', 'C1', '')`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := pool.Exec(t.Context(), sql); err == nil {
				t.Fatal("accepted")
			}
		})
	}

	if _, err := pool.Exec(
		t.Context(),
		row+`('br_ispb', '18236120', 'br_ifdata', '2026-06-30', 'BRL', 'C1', 'NU')`,
	); err != nil {
		t.Fatal(err)
	}

	// The same identifier of a scheme is one row.
	if _, err := pool.Exec(
		t.Context(),
		row+`('br_ispb', '18236120', 'br_ifdata', '2026-03-31', 'BRL', 'C1', 'NU')`,
	); err == nil {
		t.Fatal("duplicate accepted")
	}
}

// A222 MQ20.
func TestSchemaRejectsInvalidSymbols(t *testing.T) {
	t.Parallel()

	pool := pgtest.New(t)
	ctx := t.Context()

	if _, err := pool.Exec(
		ctx,
		`INSERT INTO marketdata_instrument_symbol VALUES ('USD', 'yahoo_chart', 'USDBRL=X')`,
	); err != nil {
		t.Fatal(err)
	}

	for name, sql := range map[string]string{
		"source outside the pattern": `INSERT INTO marketdata_instrument_symbol VALUES ('EUR', 'Yahoo', 'EURUSD=X')`,
		"symbol with a space":        `INSERT INTO marketdata_instrument_symbol VALUES ('EUR', 'yahoo_chart', 'BRK B')`,
		"symbol of 41 characters":    `INSERT INTO marketdata_instrument_symbol VALUES ('EUR', 'yahoo_chart', '` + strings.Repeat("A", 41) + `')`,
		"unknown instrument":         `INSERT INTO marketdata_instrument_symbol VALUES ('NOPE', 'yahoo_chart', 'NOPE')`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, sql); err == nil {
				t.Fatal("accepted")
			}
		})
	}
}

func TestSchemaRejectsInvalidInstrumentOwner(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)

	ctx := t.Context()

	var booksID int64
	if err := pool.QueryRow(ctx, `INSERT INTO identity_books (region, name) VALUES ('PT', 'Owner') RETURNING id`).
		Scan(&booksID); err != nil {
		t.Fatal(err)
	}

	const cols = `INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, books_id, issuer, issuer_scheme, issuer_id) VALUES `

	tests := []struct{ name, sql string }{
		{
			"stock owned by a book",
			cols + `('PETR4', 'stock', 0, 'Petrobras', 'BRL', $1, null, null, null)`,
		},
		{
			"issuer scheme without id",
			cols + `('RF.280302.CS3YS', 'fixed_income', 0, 'CDB', 'BRL', null, 'Banco', 'br_cnpj', null)`,
		},
		{
			"issuer id without scheme",
			cols + `('RF.280302.CS3YS', 'fixed_income', 0, 'CDB', 'BRL', null, 'Banco', null, '1')`,
		},
		{
			"issuer with spaces around the name",
			cols + `('RF.280302.CS3YS', 'fixed_income', 0, 'CDB', 'BRL', null, ' Banco ', null, null)`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			args := []any{}
			if strings.Contains(tt.sql, "$1") {
				args = append(args, booksID)
			}

			if _, err := pool.Exec(ctx, tt.sql, args...); err == nil ||
				!strings.Contains(err.Error(), "violates check constraint") {
				t.Fatalf("err = %v, want a check violation", err)
			}
		})
	}
}
