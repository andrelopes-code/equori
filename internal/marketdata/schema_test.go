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

// Indexer comparison IC12.
func TestSchemaRejectsInvalidCurvePoints(t *testing.T) {
	t.Parallel()

	pool := pgtest.New(t)
	if _, err := pool.Exec(
		t.Context(),
		`INSERT INTO marketdata_curve_point (curve_id, maturity, rate, base_date, source) `+
			`VALUES ('br_tesouro_prefixed', '2030-01-01', 0.13, '2026-11-16', 'br_tesouro')`,
	); err != nil {
		t.Fatal(err)
	}

	for name, sql := range map[string]string{
		"curve outside the pattern":  `INSERT INTO marketdata_curve_point (curve_id, maturity, rate, base_date, source) VALUES ('BR', '2030-01-01', 0.13, '2026-11-16', 'br_tesouro')`,
		"source outside the pattern": `INSERT INTO marketdata_curve_point (curve_id, maturity, rate, base_date, source) VALUES ('br_tesouro_prefixed', '2030-01-01', 0.13, '2026-11-16', 'BR_TESOURO')`,
		"rate at -100%":              `INSERT INTO marketdata_curve_point (curve_id, maturity, rate, base_date, source) VALUES ('br_tesouro_prefixed', '2030-01-01', -1, '2026-11-16', 'br_tesouro')`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := pool.Exec(t.Context(), sql); err == nil {
				t.Fatal("accepted")
			}
		})
	}
}

func TestSchemaRejectsInvalidFundReports(t *testing.T) {
	t.Parallel()

	const row = `INSERT INTO marketdata_fund_report ` +
		`(source, exchange, code, period, currency, identifier, name, segment) VALUES `

	pool := pgtest.New(t)
	if _, err := pool.Exec(
		t.Context(),
		row+`('br_cvm_fii', 'BVMF', 'HGLG11', '2026-10-01', 'BRL', '11728688000147', 'FII', 'Logistics')`,
	); err != nil {
		t.Fatal(err)
	}

	// FR15: two funds may give one code when both rows are marked shared.
	if _, err := pool.Exec(
		t.Context(),
		`INSERT INTO marketdata_fund_report `+
			`(source, exchange, code, period, currency, identifier, name, segment, shared) VALUES `+
			`('br_cvm_fii', 'BVMF', 'ABCD11', '2026-10-01', 'BRL', '2', 'B', '', true), `+
			`('br_cvm_fii', 'BVMF', 'ABCD11', '2026-10-01', 'BRL', '3', 'C', '', true)`,
	); err != nil {
		t.Fatal(err)
	}

	for name, sql := range map[string]string{
		"source outside the pattern": row + `('BR_CVM', 'BVMF', 'HGLG11', '2026-10-01', 'BRL', '1', 'FII', '')`,
		"exchange in lower case":     row + `('br_cvm_fii', 'bvmf', 'HGLG11', '2026-10-01', 'BRL', '1', 'FII', '')`,
		"period not the first day":   row + `('br_cvm_fii', 'BVMF', 'HGLG11', '2026-10-02', 'BRL', '1', 'FII', '')`,
		"empty identifier":           row + `('br_cvm_fii', 'BVMF', 'HGLG11', '2026-10-01', 'BRL', '', 'FII', '')`,
		"duplicate of a stored fund": row + `('br_cvm_fii', 'BVMF', 'HGLG11', '2026-10-01', 'BRL', '1', 'FII', '')`,
		"one fund twice in a period": row + `('br_cvm_fii', 'BVMF', 'HGLX11', '2026-10-01', 'BRL', '11728688000147', 'FII', '')`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := pool.Exec(t.Context(), sql); err == nil {
				t.Fatal("accepted")
			}
		})
	}
}

// CR6.
func TestSchemaRejectsInvalidCompanyReports(t *testing.T) {
	t.Parallel()

	const report = `INSERT INTO marketdata_company_report ` +
		`(source, identifier, period, months, file, currency, name, consolidated, plan) VALUES `
	const listing = `INSERT INTO marketdata_company_listing ` +
		`(source, exchange, code, identifier, name) VALUES `

	pool := pgtest.New(t)
	for _, sql := range []string{
		report + `('br_cvm_cia', '84429695000111', '2025-12-31', 12, 'dfp_2025', 'BRL', 'WEG', true, 'standard')`,
		listing + `('br_cvm_cia', 'BVMF', 'WEGE3', '84429695000111', 'WEG')`,
	} {
		if _, err := pool.Exec(t.Context(), sql); err != nil {
			t.Fatal(err)
		}
	}

	for name, sql := range map[string]string{
		"report source outside the pattern": report + `('BR_CVM', '1', '2025-12-31', 12, 'dfp_2025', 'BRL', 'WEG', true, 'standard')`,
		"report months 0":                   report + `('br_cvm_cia', '1', '2025-12-31', 0, 'dfp_2025', 'BRL', 'WEG', true, 'standard')`,
		"report months 13":                  report + `('br_cvm_cia', '1', '2025-12-31', 13, 'dfp_2025', 'BRL', 'WEG', true, 'standard')`,
		"report file outside the pattern":   report + `('br_cvm_cia', '1', '2025-12-31', 12, 'DFP-2025', 'BRL', 'WEG', true, 'standard')`,
		"report currency in lower case":     report + `('br_cvm_cia', '1', '2025-12-31', 12, 'dfp_2025', 'brl', 'WEG', true, 'standard')`,
		"report empty name":                 report + `('br_cvm_cia', '1', '2025-12-31', 12, 'dfp_2025', 'BRL', '', true, 'standard')`,
		"report plan outside the pattern":   report + `('br_cvm_cia', '1', '2025-12-31', 12, 'dfp_2025', 'BRL', 'WEG', true, 'Other')`,
		"report duplicate":                  report + `('br_cvm_cia', '84429695000111', '2025-12-31', 12, 'itr_2025', 'BRL', 'WEG', true, 'standard')`,
		"listing exchange in lower case":    listing + `('br_cvm_cia', 'bvmf', 'WEGE3', '1', 'WEG')`,
		"listing code in lower case":        listing + `('br_cvm_cia', 'BVMF', 'wege3', '1', 'WEG')`,
		"listing empty identifier":          listing + `('br_cvm_cia', 'BVMF', 'WEGE4', '', 'WEG')`,
		"listing duplicate":                 listing + `('br_cvm_cia', 'BVMF', 'WEGE3', '2', 'WEG')`,
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

	// Another period of the same identifier is another row; the same period is a duplicate (H2).
	if _, err := pool.Exec(
		t.Context(),
		row+`('br_ispb', '18236120', 'br_ifdata', '2026-03-31', 'BRL', 'C1', 'NU')`,
	); err != nil {
		t.Fatal(err)
	}

	if _, err := pool.Exec(
		t.Context(),
		row+`('br_ispb', '18236120', 'br_ifdata', '2026-06-30', 'BRL', 'C1', 'NU')`,
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

// A236 FC6: a payment states an amortization of 0 to 10000 bp, pays interest or returns principal,
// and the amortizations of one instrument sum to at most 10000 bp (checked at commit).
func TestSchemaRejectsInvalidPayments(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)

	ctx := t.Context()
	if _, err := pool.Exec(
		ctx,
		`INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency)
		VALUES ('CDBXPTO', 'fixed_income', 0, 'CDB', 'BRL');
		INSERT INTO marketdata_fixed_income_terms (instrument_code, issued_on, matures_on, percent_of_index_bp, spread_bp, day_count, face_value)
		VALUES ('CDBXPTO', '2026-01-02', '2028-01-02', 10000, 1200, 'act365', 100000)`,
	); err != nil {
		t.Fatal(err)
	}

	const cols = `INSERT INTO marketdata_fixed_income_payment (instrument_code, pays_on, amortization_bp, pays_interest) VALUES `

	tests := []struct{ name, sql string }{
		{"amortization above 10000", cols + `('CDBXPTO', '2027-01-04', 10001, true)`},
		{"negative amortization", cols + `('CDBXPTO', '2027-01-04', -1, true)`},
		{"neither interest nor principal", cols + `('CDBXPTO', '2027-01-04', 0, false)`},
		{"unknown instrument", cols + `('NOPE11', '2027-01-04', 0, true)`},
		{
			"same date twice",
			cols + `('CDBXPTO', '2027-01-04', 0, true), ('CDBXPTO', '2027-01-04', 0, true)`,
		},
		{
			"amortizations above 10000 in total",
			cols + `('CDBXPTO', '2027-01-04', 6000, true), ('CDBXPTO', '2028-01-02', 6000, true)`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, tt.sql); err == nil {
				t.Fatal("accepted")
			}
		})
	}

	if _, err := pool.Exec(
		ctx,
		cols+`('CDBXPTO', '2027-01-04', 6000, true), ('CDBXPTO', '2028-01-02', 4000, true)`,
	); err != nil {
		t.Fatalf("amortizations of 10000 in total: %v", err)
	}
}
