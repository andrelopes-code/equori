package app

import (
	"encoding/json/jsontext"
	"encoding/json/v2"
	"fmt"
	"slices"
)

// ArchiveVersion is the archive_version this instance writes and the highest it reads
// (ADR 021). It is the number of steps in archiveSteps plus 1.
const ArchiveVersion = 4

// ArchiveStep migrates the tables of an archive from one version to the next; it is pure and
// leaves its input unchanged (ADR 021, V3).
type ArchiveStep func([]ArchiveTable) ([]ArchiveTable, error)

// archiveSteps holds at index i the step from version i+1 to i+2. A change to an exported
// table appends its step here and increments ArchiveVersion in the same commit (ADR 021, V2).
var archiveSteps = []ArchiveStep{addExcludedFromLiquidity, addBudgetReference, addStatementBasis}

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
// (budget plan amendment A131). Version 2 has no rows for it, and a user without a stored choice
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

// withField returns tables with field set to value in every row of table; the input is left
// unchanged.
func withField(tables []ArchiveTable, table, field string, value jsontext.Value) ([]ArchiveTable, error) {
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

			fields[field] = value
			b, err := json.Marshal(fields, json.Deterministic(true))
			if err != nil {
				return nil, fmt.Errorf("%s row %d: %w", table, j, err)
			}

			out[i].Rows[j] = b
		}
	}

	return out, nil
}
