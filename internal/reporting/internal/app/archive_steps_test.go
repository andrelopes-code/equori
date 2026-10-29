package app

import (
	"encoding/json/v2"
	"errors"
	"slices"
	"strings"
	"testing"
)

// A synthetic step from version 1 to 2 that renames a column of one table (ADR 021, V3).
func renameColumn(tables []ArchiveTable) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, len(tables))
	for i, t := range tables {
		out[i] = ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)}
		if t.Name != "ledger_payee" {
			continue
		}
		for j, row := range t.Rows {
			out[i].Rows[j] = []byte(strings.Replace(string(row), `"label":`, `"name":`, 1))
		}
	}
	return out, nil
}

func TestMigrateArchive(t *testing.T) {
	t.Parallel()
	v1 := []ArchiveTable{
		{Name: "ledger_payee", Rows: [][]byte{[]byte(`{"id":"a","label":"Market"}`)}},
		{Name: "ledger_tag", Rows: [][]byte{[]byte(`{"id":"b","label":"trip"}`)}},
	}
	steps := []ArchiveStep{renameColumn}
	got, err := migrateArchive(v1, 1, steps)
	if err != nil {
		t.Fatal(err)
	}
	if string(got[0].Rows[0]) != `{"id":"a","name":"Market"}` || string(got[1].Rows[0]) != `{"id":"b","label":"trip"}` {
		t.Fatalf("migrated = %s, %s", got[0].Rows[0], got[1].Rows[0])
	}
	if string(v1[0].Rows[0]) != `{"id":"a","label":"Market"}` {
		t.Fatalf("the step changed its input: %s", v1[0].Rows[0])
	}
	same, err := migrateArchive(v1, 2, steps)
	if err != nil || string(same[0].Rows[0]) != `{"id":"a","label":"Market"}` {
		t.Fatalf("an archive of the current version = %s, %v", same[0].Rows[0], err)
	}
	broken := errors.New("broken")
	_, err = migrateArchive(v1, 1, []ArchiveStep{func([]ArchiveTable) ([]ArchiveTable, error) { return nil, broken }})
	if !errors.Is(err, broken) || !strings.Contains(err.Error(), "version 1 to 2") {
		t.Fatalf("a failed step = %v", err)
	}
	if ArchiveVersion != len(archiveSteps)+1 {
		t.Fatalf("ArchiveVersion = %d with %d steps", ArchiveVersion, len(archiveSteps))
	}
}

// Analytics design 4.3, ADR 021 V3: version 1 rows of ledger_account gain excluded_from_liquidity false.
func TestAddExcludedFromLiquidity(t *testing.T) {
	t.Parallel()
	v1 := []ArchiveTable{
		{Name: "ledger_account", Rows: [][]byte{[]byte(`{"id":"a","name":"Checking"}`)}},
		{Name: "ledger_payee", Rows: [][]byte{[]byte(`{"id":"b","name":"Market"}`)}},
	}
	got, err := addExcludedFromLiquidity(v1)
	if err != nil {
		t.Fatal(err)
	}
	var row map[string]any
	if err := json.Unmarshal(got[0].Rows[0], &row); err != nil {
		t.Fatal(err)
	}
	if row["excluded_from_liquidity"] != false || row["name"] != "Checking" || row["id"] != "a" {
		t.Fatalf("ledger_account row = %s", got[0].Rows[0])
	}
	if string(got[1].Rows[0]) != `{"id":"b","name":"Market"}` {
		t.Fatalf("ledger_payee row = %s", got[1].Rows[0])
	}
	if string(v1[0].Rows[0]) != `{"id":"a","name":"Checking"}` {
		t.Fatalf("the step changed its input: %s", v1[0].Rows[0])
	}
}

// Budget plan amendment A131, ADR 021 V2: version 2 holds no planning_budget_reference; the
// step carries every table over unchanged and the instance reads the default reference.
func TestAddBudgetReference(t *testing.T) {
	t.Parallel()
	v2 := []ArchiveTable{{Name: "planning_budget", Rows: [][]byte{[]byte(`{"id":"a"}`)}}}
	got, err := addBudgetReference(v2)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Name != "planning_budget" || string(got[0].Rows[0]) != `{"id":"a"}` {
		t.Fatalf("tables = %+v", got)
	}
	if ArchiveVersion < 3 {
		t.Fatalf("ArchiveVersion = %d, want at least 3", ArchiveVersion)
	}
}

// Card billing amendment A136, ADR 021 V2: version 3 rows of ledger_posting gain
// statement_basis "date", the basis the ledger gives every posting it cannot place otherwise.
func TestAddStatementBasis(t *testing.T) {
	t.Parallel()
	v3 := []ArchiveTable{
		{Name: "ledger_posting", Rows: [][]byte{[]byte(`{"amount":-713,"id":"a"}`)}},
		{Name: "ledger_payee", Rows: [][]byte{[]byte(`{"id":"b"}`)}},
	}

	got, err := addStatementBasis(v3)

	if err != nil {
		t.Fatal(err)
	}
	if string(got[0].Rows[0]) != `{"amount":-713,"id":"a","statement_basis":"date"}` {
		t.Fatalf("ledger_posting row = %s", got[0].Rows[0])
	}
	if string(got[1].Rows[0]) != `{"id":"b"}` || string(v3[0].Rows[0]) != `{"amount":-713,"id":"a"}` {
		t.Fatalf("other table %s, input %s", got[1].Rows[0], v3[0].Rows[0])
	}
	if ArchiveVersion != 4 {
		t.Fatalf("ArchiveVersion = %d, want 4", ArchiveVersion)
	}
}
