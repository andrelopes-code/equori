package postgres

import (
	"slices"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// Export design E2: a table is a fact, shared, or named as left out. A new table without
// books_id fails here until it is classified.
func TestEveryTableIsClassified(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)

	rows, err := pool.Query(t.Context(), `SELECT table_name FROM information_schema.tables
		WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY table_name`)
	if err != nil {
		t.Fatal(err)
	}

	all, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatal(err)
	}

	facts, err := FactTables(t.Context(), pool)
	if err != nil {
		t.Fatal(err)
	}

	// marketdata_feed holds the instance's feed settings (ADR 025 F1) and marketdata_index_expectation
	// the latest survey a feed fetches again (ADR 026 E3); neither holds a book's rows.
	// ingestion_instance_settings holds the instance's sync interval (ADR 029 BK23).
	// instance_settings holds the instance's update check and encrypted copy (protected data design).
	// identity_totp, identity_recovery_code, identity_passkey, identity_passkey_challenge and
	// identity_login_challenge hold a member's second factor (ADR 030); they have no books_id.
	other := []string{"goose_db_version", "identity_books", "identity_login_challenge", "identity_member", "identity_passkey",
		"identity_passkey_challenge", "identity_recovery_code", "identity_totp", "ingestion_instance_settings",
		"instance_settings", "ledger_transaction_version", "marketdata_feed", "marketdata_index_expectation", "outbox_delivery"}
	for _, table := range all {
		if !slices.Contains(facts, table) && !slices.Contains(sharedTables, table) && !slices.Contains(notExported, table) && !slices.Contains(other, table) {
			t.Errorf("table %s is neither exported nor named as left out", table)
		}
	}

	for _, table := range append(slices.Clone(sharedTables), notExported...) {
		if !slices.Contains(all, table) {
			t.Errorf("table %s does not exist", table)
		}
	}
}
