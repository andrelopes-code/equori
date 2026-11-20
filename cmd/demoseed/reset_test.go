package main

import (
	_ "embed"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

//go:embed reset.sql
var resetSQL string

// A security of the demo book holds rows in tables without books_id (its prices); the reset runs
// with the checks off, so the cascade of the foreign keys does not delete them.
func TestResetLeavesNoRowWithoutItsParent(t *testing.T) {
	h := apitest.New(t)
	h.LoginAs("demo@equori.local", locale.Locale{Language: "pt", Region: "BR"}, "BRL")
	books := h.BooksIDOf("demo@equori.local")

	const instrument = `INSERT INTO marketdata_instrument
		(code, instrument_type, scale, name, quote_currency, books_id)
		VALUES ('RF.270101.TEST1', 'fixed_income', 2, 'CDB', 'BRL', $1)`
	if _, err := h.Pool.Exec(t.Context(), instrument, books); err != nil {
		t.Fatal(err)
	}

	const price = `INSERT INTO marketdata_price
		(instrument, quote_instrument, date, value, source, priority)
		VALUES ('RF.270101.TEST1', 'BRL', '2026-11-05', 1000, 'accrual', 4)`
	if _, err := h.Pool.Exec(t.Context(), price); err != nil {
		t.Fatal(err)
	}

	script := strings.ReplaceAll(resetSQL, "@EMAIL@", "demo@equori.local")
	if _, err := h.Pool.Exec(t.Context(), script); err != nil {
		t.Fatal(err)
	}

	var orphans int

	const count = `SELECT count(*) FROM marketdata_price p
		WHERE NOT EXISTS (SELECT 1 FROM marketdata_instrument i WHERE i.code = p.instrument)`
	if err := h.Pool.QueryRow(t.Context(), count).Scan(&orphans); err != nil {
		t.Fatal(err)
	}

	if orphans != 0 {
		t.Errorf("prices without their instrument = %d, want 0", orphans)
	}
}
