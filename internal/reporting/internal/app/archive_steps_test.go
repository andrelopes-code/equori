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

	if ArchiveVersion < 4 {
		t.Fatalf("ArchiveVersion = %d, want at least 4", ArchiveVersion)
	}
}

// Households design HA55, ADR 021 V2: version 5 leaves out the assistant's conversations,
// messages and proposals.
func TestDropConversations(t *testing.T) {
	t.Parallel()

	v4 := []ArchiveTable{
		{Name: "assistant_conversation", Rows: [][]byte{[]byte(`{"id":"c"}`)}},
		{Name: "ledger_payee", Rows: [][]byte{[]byte(`{"id":"b"}`)}},
		{Name: "assistant_message", Rows: [][]byte{[]byte(`{"id":"m"}`)}},
		{Name: "assistant_proposal", Rows: [][]byte{[]byte(`{"id":"p"}`)}},
	}

	got, err := dropConversations(v4)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 1 || got[0].Name != "ledger_payee" || string(got[0].Rows[0]) != `{"id":"b"}` {
		t.Fatalf("tables = %+v", got)
	}

	if len(v4) != 4 {
		t.Fatalf("input has %d tables, want 4", len(v4))
	}
}

// Reliable sync amendments A143, A146, A148, ADR 021 V2: version 5 rows of
// ingestion_external_record report their own amount and date, with no decision to undo and not
// kept; version 5 rows of ingestion_batch re-identified no line and were not an empty read.
func TestAddReliableSync(t *testing.T) {
	t.Parallel()

	v5 := []ArchiveTable{
		{
			Name: "ingestion_external_record",
			Rows: [][]byte{[]byte(`{"amount":-713,"booked_on":"2026-03-02","id":"a"}`)},
		},
		{Name: "ingestion_batch", Rows: [][]byte{[]byte(`{"id":"b"}`)}},
		{Name: "ledger_payee", Rows: [][]byte{[]byte(`{"id":"c"}`)}},
	}

	got, err := addReliableSync(v5)
	if err != nil {
		t.Fatal(err)
	}

	record := `{"amount":-713,"booked_on":"2026-03-02","decision_undo":{},"id":"a","kept":false,` +
		`"reported_amount":-713,"reported_on":"2026-03-02"}`
	if string(got[0].Rows[0]) != record {
		t.Fatalf("ingestion_external_record row = %s", got[0].Rows[0])
	}

	if string(got[1].Rows[0]) != `{"id":"b","re_identified":0,"read_empty":false}` {
		t.Fatalf("ingestion_batch row = %s", got[1].Rows[0])
	}

	input := `{"amount":-713,"booked_on":"2026-03-02","id":"a"}`
	if string(got[2].Rows[0]) != `{"id":"c"}` || string(v5[0].Rows[0]) != input {
		t.Fatalf("other table %s, input %s", got[2].Rows[0], v5[0].Rows[0])
	}

	if ArchiveVersion < 6 {
		t.Fatalf("ArchiveVersion = %d, want at least 6", ArchiveVersion)
	}
}

// Version 6 rows of planning_budget_reference hold no savings target; the column reads null.
func TestAddSavingsTarget(t *testing.T) {
	t.Parallel()

	v6 := []ArchiveTable{{Name: "planning_budget_reference", Rows: [][]byte{[]byte(`{"id":"a"}`)}}}

	got, err := addSavingsTarget(v6)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 1 || string(got[0].Rows[0]) != `{"id":"a"}` {
		t.Fatalf("planning_budget_reference = %v", got)
	}

	if ArchiveVersion < 7 {
		t.Fatalf("ArchiveVersion = %d, want at least 7", ArchiveVersion)
	}
}

// Version 7 rows of planning_schedule hold no match window; the step gives each the 7 days every
// schedule matched with before the column existed (A51).
func TestAddMatchWindow(t *testing.T) {
	t.Parallel()

	v7 := []ArchiveTable{
		{Name: "planning_schedule", Rows: [][]byte{[]byte(`{"id":"a"}`), []byte(`{"id":"b"}`)}},
		{Name: "planning_occurrence", Rows: [][]byte{[]byte(`{"id":"o"}`)}},
	}

	got, err := addMatchWindow(v7)
	if err != nil {
		t.Fatal(err)
	}

	want := []string{`{"id":"a","match_window_days":7}`, `{"id":"b","match_window_days":7}`}
	if len(got) != 2 || len(got[0].Rows) != 2 ||
		string(got[0].Rows[0]) != want[0] || string(got[0].Rows[1]) != want[1] {
		t.Fatalf("planning_schedule = %q, want %q", got[0].Rows, want)
	}

	if string(got[1].Rows[0]) != `{"id":"o"}` {
		t.Fatalf("planning_occurrence = %q, want it unchanged", got[1].Rows)
	}

	if string(v7[0].Rows[0]) != `{"id":"a"}` {
		t.Fatalf("the input changed: %q", v7[0].Rows)
	}

	if ArchiveVersion < 8 {
		t.Fatalf("ArchiveVersion = %d, want at least 8", ArchiveVersion)
	}
}

// Export design T2: version 9 adds files for the assistant tables and changes no row.
func TestAddAssistantConfiguration(t *testing.T) {
	t.Parallel()

	v8 := []ArchiveTable{{Name: "planning_schedule", Rows: [][]byte{[]byte(`{"id":"a"}`)}}}

	got, err := addAssistantConfiguration(v8)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 1 || got[0].Name != "planning_schedule" || string(got[0].Rows[0]) != `{"id":"a"}` {
		t.Fatalf("tables = %+v, want them unchanged", got)
	}

	if ArchiveVersion < 9 {
		t.Fatalf("ArchiveVersion = %d, want at least 9", ArchiveVersion)
	}
}

// Version 9 rows of ingestion_csv_profile hold no footer rows, sign column or debit marker; the
// step gives the values no earlier profile could set (A204).
func TestAddCsvReading(t *testing.T) {
	t.Parallel()

	v9 := []ArchiveTable{
		{Name: "ingestion_csv_profile", Rows: [][]byte{[]byte(`{"account_id":"a"}`)}},
		{Name: "planning_schedule", Rows: [][]byte{[]byte(`{"id":"s"}`)}},
	}

	got, err := addCsvReading(v9)
	if err != nil {
		t.Fatal(err)
	}

	want := `{"account_id":"a","debit_marker":null,"footer_rows":0,"sign_column":null}`
	if len(got) != 2 || string(got[0].Rows[0]) != want {
		t.Fatalf("ingestion_csv_profile = %q, want %q", got[0].Rows, want)
	}

	if string(got[1].Rows[0]) != `{"id":"s"}` {
		t.Fatalf("planning_schedule = %q, want it unchanged", got[1].Rows)
	}

	if string(v9[0].Rows[0]) != `{"account_id":"a"}` {
		t.Fatalf("the input changed: %q", v9[0].Rows)
	}
}

func TestAddExternalIdentity(t *testing.T) {
	t.Parallel()

	v10 := []ArchiveTable{
		{Name: "ingestion_external_account", Rows: [][]byte{[]byte(`{"id":"e"}`)}},
		{Name: "planning_schedule", Rows: [][]byte{[]byte(`{"id":"s"}`)}},
	}

	got, err := addExternalIdentity(v10)
	if err != nil {
		t.Fatal(err)
	}

	want := `{"gone_since":null,"id":"e","name_from":null,"name_on":null}`
	if len(got) != 2 || string(got[0].Rows[0]) != want {
		t.Fatalf("ingestion_external_account = %q, want %q", got[0].Rows, want)
	}

	if string(got[1].Rows[0]) != `{"id":"s"}` {
		t.Fatalf("planning_schedule = %q, want it unchanged", got[1].Rows)
	}

	if string(v10[0].Rows[0]) != `{"id":"e"}` {
		t.Fatalf("the input changed: %q", v10[0].Rows)
	}

	if ArchiveVersion != 11 {
		t.Fatalf("ArchiveVersion = %d, want 11", ArchiveVersion)
	}
}
