package postgres

import (
	"slices"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// Export design E2: a table is a fact, shared, or named as left out. A new table without
// user_id fails here until it is classified.
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
	other := []string{"goose_db_version", "identity_user", "ledger_transaction_version", "outbox_delivery"}
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
