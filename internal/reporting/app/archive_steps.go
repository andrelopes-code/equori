package app

import (
	"encoding/json/jsontext"
	"encoding/json/v2"
	"fmt"
	"slices"
)

// ArchiveVersion is the archive_version this instance writes and the highest it reads
// (ADR 021). It is the number of steps in archiveSteps plus 1.
const ArchiveVersion = 23

// ArchiveStep migrates the tables of an archive from one version to the next; it is pure and
// leaves its input unchanged (ADR 021, V3).
type ArchiveStep func([]ArchiveTable) ([]ArchiveTable, error)

// archiveSteps holds at index i the step from version i+1 to i+2. A change to an exported
// table appends its step here and increments ArchiveVersion in the same commit (ADR 021, V2).
var archiveSteps = []ArchiveStep{
	addExcludedFromLiquidity,
	addBudgetReference,
	addStatementBasis,
	dropConversations,
	addReliableSync,
	addSavingsTarget,
	addMatchWindow,
	addAssistantConfiguration,
	addCsvReading,
	addExternalIdentity,
	addTransferPairing,
	addInstrumentSymbols,
	addContributionPlan,
	addDayTradeColumns,
	addCorporateActions,
	addBuckets,
	addBucketDirections,
	addTermsLiquidity,
	addInstrumentOwner,
	addFixedIncomePayments,
	addInstrumentHidden,
	addGoalSavings,
}

// migrateArchive applies the steps from version from to the last one, in order.
func migrateArchive(tables []ArchiveTable, from int, steps []ArchiveStep) ([]ArchiveTable, error) {
	for v := from; v <= len(steps); v++ {
		var err error
		if tables, err = steps[v-1](tables); err != nil {
			return nil, fmt.Errorf("migrate archive from version %d to %d: %w", v, v+1, err)
		}
	}

	return tables, nil
}

// addExcludedFromLiquidity writes false into excluded_from_liquidity of every version 1 row of
// ledger_account (analytics design 4.3).
func addExcludedFromLiquidity(tables []ArchiveTable) ([]ArchiveTable, error) {
	return withField(tables, "ledger_account", "excluded_from_liquidity", jsontext.Value("false"))
}

// addBudgetReference moves a version 2 archive to version 3, which adds planning_budget_reference
// (budget plan amendment A131). Version 2 has no rows for it, and a book without a stored choice
// reads the default reference, so every table carries over unchanged.
func addBudgetReference(tables []ArchiveTable) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, len(tables))
	for i, t := range tables {
		out[i] = ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)}
	}

	return out, nil
}

// addStatementBasis writes "date" into statement_basis of every version 3 row of ledger_posting
// (card billing amendment A136): the ledger cannot tell which of them a line's bill placed.
func addStatementBasis(tables []ArchiveTable) ([]ArchiveTable, error) {
	return withField(tables, "ledger_posting", "statement_basis", jsontext.Value(`"date"`))
}

// dropConversations moves a version 4 archive to version 5, which leaves out the assistant's
// conversations, messages and proposals: each belongs to one member (households design HA55).
func dropConversations(tables []ArchiveTable) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, 0, len(tables))
	for _, t := range tables {
		switch t.Name {
		case "assistant_conversation", "assistant_message", "assistant_proposal":
			continue
		}

		out = append(out, ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)})
	}

	return out, nil
}

// addReliableSync moves a version 5 archive to version 6, which adds the columns of the reliable
// sync (amendments A143 to A153). Each record reports its own amount and date, as migration
// 00077 gives existing rows, with no decision to undo and not kept; each batch re-identified no
// line and was not an empty read. The new nullable columns read null.
func addReliableSync(tables []ArchiveTable) ([]ArchiveTable, error) {
	tables, err := editRows(
		tables,
		"ingestion_external_record",
		func(fields map[string]jsontext.Value) {
			fields["reported_amount"] = fields["amount"]
			fields["reported_on"] = fields["booked_on"]
			fields["decision_undo"] = jsontext.Value("{}")
			fields["kept"] = jsontext.Value("false")
		},
	)
	if err != nil {
		return nil, err
	}

	return editRows(tables, "ingestion_batch", func(fields map[string]jsontext.Value) {
		fields["re_identified"] = jsontext.Value("0")
		fields["read_empty"] = jsontext.Value("false")
	})
}

// addSavingsTarget moves a version 6 archive to version 7, which adds savings_target_bp to
// planning_budget_reference (migration 00082). The column is nullable, so a version 6 row reads
// no target and the step leaves every row unchanged.
func addSavingsTarget(tables []ArchiveTable) ([]ArchiveTable, error) {
	return tables, nil
}

// addMatchWindow moves a version 7 archive to version 8, which adds match_window_days to
// planning_schedule (migration 00087). Every earlier schedule matched within 7 days (A51), so the
// step gives each row that value.
func addMatchWindow(tables []ArchiveTable) ([]ArchiveTable, error) {
	return withField(tables, "planning_schedule", "match_window_days", jsontext.Value("7"))
}

// addCsvReading moves a version 9 archive to version 10, which adds footer_rows, sign_column and
// debit_marker to ingestion_csv_profile (migration 00090). No earlier profile set them.
func addCsvReading(tables []ArchiveTable) ([]ArchiveTable, error) {
	for _, f := range []struct {
		field string
		value string
	}{{"footer_rows", "0"}, {"sign_column", "null"}, {"debit_marker", "null"}} {
		var err error

		tables, err = withField(tables, "ingestion_csv_profile", f.field, jsontext.Value(f.value))
		if err != nil {
			return nil, err
		}
	}

	return tables, nil
}

// addExternalIdentity moves a version 10 archive to version 11, which adds name_from, name_on and
// gone_since to ingestion_external_account (migration 00091). No earlier row holds a bound.
func addExternalIdentity(tables []ArchiveTable) ([]ArchiveTable, error) {
	for _, field := range []string{"name_from", "name_on", "gone_since"} {
		var err error

		tables, err = withField(tables, "ingestion_external_account", field, jsontext.Value("null"))
		if err != nil {
			return nil, err
		}
	}

	return tables, nil
}

// addTransferPairing moves a version 11 archive to version 12, which adds holder_digest to
// ingestion_external_account, counterparty to ingestion_external_record and paired to
// ingestion_batch (migration 00092). No earlier row holds a holder or a counterparty, and no
// earlier sync paired a line.
func addTransferPairing(tables []ArchiveTable) ([]ArchiveTable, error) {
	for _, f := range []struct {
		table string
		field string
		value string
	}{
		{"ingestion_external_account", "holder_digest", "null"},
		{"ingestion_external_record", "counterparty", "null"},
		{"ingestion_batch", "paired", "0"},
	} {
		var err error

		tables, err = withField(tables, f.table, f.field, jsontext.Value(f.value))
		if err != nil {
			return nil, err
		}
	}

	return tables, nil
}

// withField returns tables with field set to value in every row of table; the input is left
// unchanged.
func withField(
	tables []ArchiveTable,
	table, field string,
	value jsontext.Value,
) ([]ArchiveTable, error) {
	return editRows(tables, table, func(fields map[string]jsontext.Value) { fields[field] = value })
}

// editRows returns tables with edit applied to the fields of every row of table; the input is
// left unchanged.
func editRows(
	tables []ArchiveTable,
	table string,
	edit func(map[string]jsontext.Value),
) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, len(tables))
	for i, t := range tables {
		out[i] = ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)}
		if t.Name != table {
			continue
		}

		for j, row := range t.Rows {
			var fields map[string]jsontext.Value
			if err := json.Unmarshal(row, &fields); err != nil {
				return nil, fmt.Errorf("%s row %d: %w", table, j, err)
			}

			edit(fields)

			b, err := json.Marshal(fields, json.Deterministic(true))
			if err != nil {
				return nil, fmt.Errorf("%s row %d: %w", table, j, err)
			}

			out[i].Rows[j] = b
		}
	}

	return out, nil
}

// addAssistantConfiguration moves a version 8 archive to version 9, which carries the assistant's
// providers, chains and limits (export design T1, T2). An older archive has no file for the three
// tables, so the step changes nothing and they import empty.
func addAssistantConfiguration(tables []ArchiveTable) ([]ArchiveTable, error) {
	return tables, nil
}

// addInstrumentSymbols moves a version 12 archive to version 13, which adds
// marketdata_instrument_symbol (migration 00095). Version 12 has no rows for it, so every table
// carries over unchanged.
func addInstrumentSymbols(tables []ArchiveTable) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, len(tables))
	for i, t := range tables {
		out[i] = ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)}
	}

	return out, nil
}

// addContributionPlan moves a version 13 archive to version 14, which adds
// portfolio_contribution_plan, portfolio_contribution_class and portfolio_contribution_member
// (migration 00096). Version 13 has no contribution plan rows, so every table carries over
// unchanged.
func addContributionPlan(tables []ArchiveTable) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, len(tables))
	for i, t := range tables {
		out[i] = ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)}
	}

	return out, nil
}

// addDayTradeColumns writes 0 into day_trade_quantity and day_trade_cost of every version 14
// row of ledger_trade (A228 IO14): a sale recorded before keeps its average cost (NG3).
func addDayTradeColumns(tables []ArchiveTable) ([]ArchiveTable, error) {
	tables, err := withField(tables, "ledger_trade", "day_trade_quantity", jsontext.Value("0"))
	if err != nil {
		return nil, err
	}

	return withField(tables, "ledger_trade", "day_trade_cost", jsontext.Value("0"))
}

// addCorporateActions moves a version 15 archive to version 16, which adds
// ledger_corporate_action (migration 00100). Version 15 has no corporate action rows, so every
// table carries over unchanged.
func addCorporateActions(tables []ArchiveTable) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, len(tables))
	for i, t := range tables {
		out[i] = ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)}
	}

	return out, nil
}

// addBuckets moves a version 16 archive to version 17, which adds planning_bucket and
// planning_bucket_category (migration 00101). Version 16 has no bucket rows, so every table
// carries over unchanged.
func addBuckets(tables []ArchiveTable) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, len(tables))
	for i, t := range tables {
		out[i] = ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)}
	}

	return out, nil
}

// addBucketDirections writes false into at_least and takes_goals of every version 17 row of
// planning_bucket (migration 00102): a bucket saved before keeps its target as a ceiling and draws
// no goal deposits (income buckets A234).
func addBucketDirections(tables []ArchiveTable) ([]ArchiveTable, error) {
	tables, err := withField(tables, "planning_bucket", "at_least", jsontext.Value("false"))
	if err != nil {
		return nil, err
	}

	return withField(tables, "planning_bucket", "takes_goals", jsontext.Value("false"))
}

// addTermsLiquidity writes null into calendar_id and redeemable_from and false into
// daily_liquidity of every version 18 row of marketdata_fixed_income_terms (migration 00103): terms
// saved before count calendar days, redeem from the issue date and carry no daily liquidity (fixed
// income complete A236).
func addTermsLiquidity(tables []ArchiveTable) ([]ArchiveTable, error) {
	const table = "marketdata_fixed_income_terms"

	tables, err := withField(tables, table, "calendar_id", jsontext.Value("null"))
	if err != nil {
		return nil, err
	}

	tables, err = withField(tables, table, "daily_liquidity", jsontext.Value("false"))
	if err != nil {
		return nil, err
	}

	return withField(tables, table, "redeemable_from", jsontext.Value("null"))
}

// addInstrumentOwner writes null into books_id, issuer, issuer_scheme and issuer_id of every version
// 19 row of marketdata_instrument (migration 00104): an instrument saved before is public and has
// no issuer (fixed income complete A236 FC1, FC3).
func addInstrumentOwner(tables []ArchiveTable) ([]ArchiveTable, error) {
	const table = "marketdata_instrument"

	for _, column := range []string{"books_id", "issuer", "issuer_scheme", "issuer_id"} {
		var err error
		if tables, err = withField(tables, table, column, jsontext.Value("null")); err != nil {
			return nil, err
		}
	}

	return tables, nil
}

// addFixedIncomePayments moves a version 20 archive to version 21, which adds
// marketdata_fixed_income_payment (migration 00106). Version 20 has no payment rows, and terms
// without payments price as before, so every table carries over unchanged.
func addFixedIncomePayments(tables []ArchiveTable) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, len(tables))
	for i, t := range tables {
		out[i] = ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)}
	}

	return out, nil
}

// addInstrumentHidden moves a version 21 archive to version 22, which adds
// marketdata_instrument_hidden (migration 00107). Version 21 hides no instrument, so every table
// carries over unchanged.
func addInstrumentHidden(tables []ArchiveTable) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, len(tables))
	for i, t := range tables {
		out[i] = ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)}
	}

	return out, nil
}

// addGoalSavings writes false into counts_as_savings of every version 22 row of planning_goal
// (migration 00110): a goal saved before counts in the bucket that takes goals (income buckets
// A239).
func addGoalSavings(tables []ArchiveTable) ([]ArchiveTable, error) {
	return withField(tables, "planning_goal", "counts_as_savings", jsontext.Value("false"))
}
