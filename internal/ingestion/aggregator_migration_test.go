package ingestion_test

import (
	"io"
	"log/slog"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// Spec §5.10: migration 48 renames provider to aggregator and open_finance to aggregator in existing rows.
func TestAggregatorTermMigration(t *testing.T) {
	t.Parallel()
	pool := pgtest.Empty(t)
	ctx := t.Context()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	if err := postgres.MigrateTo(ctx, pool, 47, log); err != nil {
		t.Fatal(err)
	}
	uid := pgtest.CreateUser(t, pool)
	var account string
	statements := []string{
		`INSERT INTO ingestion_integration (id, user_id, provider, name, credential_ciphertext) VALUES (uuidv7(), $1, 'pluggy', 'Meu Pluggy', '\x01')`,
		`INSERT INTO classification_source_category (user_id, provider, external_id, name) VALUES ($1, 'pluggy', '05010000', 'Food')`,
	}
	for _, s := range statements {
		if _, err := pool.Exec(ctx, s, uid); err != nil {
			t.Fatal(err)
		}
	}
	if err := pool.QueryRow(ctx, `INSERT INTO ledger_account (user_id, name, account_class, kind, instrument, opened_on) VALUES ($1, 'Nubank', 'asset', 'checking', 'BRL', '2026-01-01') RETURNING id`, uid).Scan(&account); err != nil {
		t.Fatal(err)
	}
	for _, s := range []string{
		`INSERT INTO ingestion_batch (user_id, account_id, source, file_name, currency) VALUES ($1, $2, 'open_finance', NULL, 'BRL')`,
		`INSERT INTO ledger_balance_assertion (user_id, account_id, date, amount, source) VALUES ($1, $2, '2026-10-01', 100, 'open_finance')`,
	} {
		if _, err := pool.Exec(ctx, s, uid, account); err != nil {
			t.Fatal(err)
		}
	}
	if err := postgres.Migrate(ctx, pool, log); err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct{ query, want string }{
		{`SELECT aggregator FROM ingestion_integration`, "pluggy"},
		{`SELECT aggregator FROM classification_source_category`, "pluggy"},
		{`SELECT source FROM ingestion_batch`, "aggregator"},
		{`SELECT source FROM ledger_balance_assertion`, "aggregator"},
	} {
		var got string
		if err := pool.QueryRow(ctx, c.query).Scan(&got); err != nil || got != c.want {
			t.Errorf("%s = %q, %v; want %q", c.query, got, err, c.want)
		}
	}
}
