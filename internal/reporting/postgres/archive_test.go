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

	// Export design T1: the assistant configuration is carried, its usage history is not.
	for table, want := range map[string]bool{
		"assistant_provider": true, "assistant_chain_target": true, "assistant_usage_limit": true, "assistant_usage": false,
	} {
		if slices.Contains(facts, table) != want {
			t.Errorf("%s in the fact tables = %t, want %t", table, !want, want)
		}
	}

	// marketdata_feed holds the instance's feed settings (ADR 025 F1) and marketdata_index_expectation
	// the latest survey a feed fetches again (ADR 026 E3); neither holds a book's rows.
	// marketdata_curve_point holds the latest curves a feed fetches again (indexer comparison IC12).
	// marketdata_fund_report holds the latest monthly reports a feed fetches again (fund report FR6).
	// marketdata_company_report and marketdata_company_listing hold the statements a feed fetches
	// again (company report CR6).
	// marketdata_history holds the instance's queue of history requests (A222 MQ4).
	// marketdata_institution_indicator holds the indicators a feed fetches again (A237).
	// ingestion_instance_settings holds the instance's sync interval (ADR 029 BK23).
	// instance_settings holds the instance's update check and encrypted copy (protected data design).
	// portfolio_rebuild_state holds the app version whose rules derived the portfolio rows.
	// identity_totp, identity_recovery_code, identity_passkey, identity_passkey_challenge and
	// identity_login_challenge hold a member's second factor (ADR 030); they have no books_id.
	// identity_account_invitation holds a pending invitation to an account of its own; it has no books_id.
	other := []string{
		"goose_db_version",
		"identity_account_invitation",
		"identity_books",
		"identity_login_challenge",
		"identity_member",
		"identity_passkey",
		"identity_passkey_challenge",
		"identity_recovery_code",
		"identity_totp",
		"ingestion_instance_settings",
		"instance_settings",
		"ledger_transaction_version",
		"marketdata_company_listing",
		"marketdata_company_report",
		"marketdata_curve_point",
		"marketdata_feed",
		"marketdata_fund_report",
		"marketdata_history",
		"marketdata_index_expectation",
		"marketdata_institution_indicator",
		"outbox_delivery",
		"portfolio_rebuild_state",
	}
	for _, table := range all {
		if !slices.Contains(facts, table) && !slices.Contains(sharedTables, table) &&
			!slices.Contains(notExported, table) &&
			!slices.Contains(other, table) {
			t.Errorf("table %s is neither exported nor named as left out", table)
		}
	}

	for _, table := range append(slices.Clone(sharedTables), notExported...) {
		if !slices.Contains(all, table) {
			t.Errorf("table %s does not exist", table)
		}
	}
}
