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

	if string(got[0].Rows[0]) != `{"id":"a","name":"Market"}` ||
		string(got[1].Rows[0]) != `{"id":"b","label":"trip"}` {
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

	_, err = migrateArchive(
		v1,
		1,
		[]ArchiveStep{func([]ArchiveTable) ([]ArchiveTable, error) { return nil, broken }},
	)
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

	if string(got[1].Rows[0]) != `{"id":"b"}` ||
		string(v3[0].Rows[0]) != `{"amount":-713,"id":"a"}` {
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

	if len(got) != 1 || got[0].Name != "planning_schedule" ||
		string(got[0].Rows[0]) != `{"id":"a"}` {
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

	if ArchiveVersion < 11 {
		t.Fatalf("ArchiveVersion = %d, want at least 11", ArchiveVersion)
	}
}

func TestAddTransferPairing(t *testing.T) {
	t.Parallel()

	v11 := []ArchiveTable{
		{Name: "ingestion_external_account", Rows: [][]byte{[]byte(`{"id":"a"}`)}},
		{Name: "ingestion_external_record", Rows: [][]byte{[]byte(`{"id":"r"}`)}},
		{Name: "ingestion_batch", Rows: [][]byte{[]byte(`{"id":"b"}`)}},
		{Name: "planning_schedule", Rows: [][]byte{[]byte(`{"id":"s"}`)}},
	}

	got, err := addTransferPairing(v11)
	if err != nil {
		t.Fatal(err)
	}

	want := []string{
		`{"holder_digest":null,"id":"a"}`,
		`{"counterparty":null,"id":"r"}`,
		`{"id":"b","paired":0}`,
		`{"id":"s"}`,
	}
	if len(got) != len(want) {
		t.Fatalf("tables = %d, want %d", len(got), len(want))
	}

	for i, w := range want {
		if string(got[i].Rows[0]) != w {
			t.Fatalf("%s = %q, want %q", got[i].Name, got[i].Rows, w)
		}
	}

	if string(v11[0].Rows[0]) != `{"id":"a"}` {
		t.Fatalf("the input changed: %q", v11[0].Rows)
	}

	if ArchiveVersion < 12 {
		t.Fatalf("ArchiveVersion = %d, want at least 12", ArchiveVersion)
	}
}

// Market quotes plan 2 D22, ADR 021 V2: version 12 holds no marketdata_instrument_symbol; the
// step carries every table over unchanged.
func TestAddInstrumentSymbols(t *testing.T) {
	t.Parallel()

	v12 := []ArchiveTable{
		{Name: "marketdata_instrument", Rows: [][]byte{[]byte(`{"code":"AAPL"}`)}},
	}

	got, err := addInstrumentSymbols(v12)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 1 || got[0].Name != "marketdata_instrument" ||
		string(got[0].Rows[0]) != `{"code":"AAPL"}` {
		t.Fatalf("tables = %+v", got)
	}

	if ArchiveVersion < 13 {
		t.Fatalf("ArchiveVersion = %d, want at least 13", ArchiveVersion)
	}
}

// Investment operations A228 IO14, ADR 021 V2: a version 14 ledger_trade row gains
// day_trade_quantity and day_trade_cost as 0.
func TestAddDayTradeColumns(t *testing.T) {
	t.Parallel()

	v14 := []ArchiveTable{
		{Name: "ledger_trade", Rows: [][]byte{[]byte(`{"cost":100,"side":"sell"}`)}},
		{Name: "ledger_account", Rows: [][]byte{[]byte(`{"id":"a"}`)}},
	}

	got, err := addDayTradeColumns(v14)
	if err != nil {
		t.Fatal(err)
	}

	want := `{"cost":100,"day_trade_cost":0,"day_trade_quantity":0,"side":"sell"}`
	if string(got[0].Rows[0]) != want {
		t.Fatalf("ledger_trade row = %s, want %s", got[0].Rows[0], want)
	}

	if string(got[1].Rows[0]) != `{"id":"a"}` ||
		string(v14[0].Rows[0]) != `{"cost":100,"side":"sell"}` {
		t.Fatalf("other table %s, input %s", got[1].Rows[0], v14[0].Rows[0])
	}

	if ArchiveVersion < 15 {
		t.Fatalf("ArchiveVersion = %d, want at least 15", ArchiveVersion)
	}
}

// Investment operations A228 IO26, ADR 021 V2: version 15 has no ledger_corporate_action rows,
// so every table carries over unchanged.
func TestAddCorporateActions(t *testing.T) {
	t.Parallel()

	v15 := []ArchiveTable{
		{Name: "ledger_trade", Rows: [][]byte{[]byte(`{"cost":100,"side":"sell"}`)}},
		{Name: "ledger_account", Rows: [][]byte{[]byte(`{"id":"a"}`)}},
	}

	got, err := addCorporateActions(v15)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 2 || string(got[0].Rows[0]) != `{"cost":100,"side":"sell"}` ||
		string(got[1].Rows[0]) != `{"id":"a"}` {
		t.Fatalf("tables = %+v", got)
	}

	if ArchiveVersion < 16 {
		t.Fatalf("ArchiveVersion = %d, want at least 16", ArchiveVersion)
	}
}

// Income buckets D1, ADR 021 V2: version 16 has no planning_bucket rows, so every table carries
// over unchanged.
func TestAddBuckets(t *testing.T) {
	t.Parallel()

	v16 := []ArchiveTable{
		{Name: "planning_budget_reference", Rows: [][]byte{[]byte(`{"source":"fixed"}`)}},
	}

	got, err := addBuckets(v16)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 1 || string(got[0].Rows[0]) != `{"source":"fixed"}` {
		t.Fatalf("tables = %+v", got)
	}

	if ArchiveVersion < 17 {
		t.Fatalf("ArchiveVersion = %d, want at least 17", ArchiveVersion)
	}
}

// Income buckets A234, ADR 021 V2: a version 17 bucket gains at_least and takes_goals, both false.
func TestAddBucketDirections(t *testing.T) {
	t.Parallel()

	v17 := []ArchiveTable{
		{Name: "planning_bucket", Rows: [][]byte{[]byte(`{"name":"Needs"}`)}},
		{Name: "planning_budget_reference", Rows: [][]byte{[]byte(`{"source":"fixed"}`)}},
	}

	got, err := addBucketDirections(v17)
	if err != nil {
		t.Fatal(err)
	}

	if string(got[0].Rows[0]) != `{"at_least":false,"name":"Needs","takes_goals":false}` ||
		string(got[1].Rows[0]) != `{"source":"fixed"}` {
		t.Fatalf("tables = %s %s", got[0].Rows[0], got[1].Rows[0])
	}

	if ArchiveVersion < 18 {
		t.Fatalf("ArchiveVersion = %d, want at least 18", ArchiveVersion)
	}
}

// Fixed income complete A236, ADR 021 V2: a version 18 terms row gains calendar_id, daily_liquidity
// and redeemable_from.
func TestAddTermsLiquidity(t *testing.T) {
	t.Parallel()

	v18 := []ArchiveTable{
		{
			Name: "marketdata_fixed_income_terms",
			Rows: [][]byte{[]byte(`{"instrument_code":"CDB1"}`)},
		},
		{Name: "planning_budget_reference", Rows: [][]byte{[]byte(`{"source":"fixed"}`)}},
	}

	got, err := addTermsLiquidity(v18)
	if err != nil {
		t.Fatal(err)
	}

	want := `{"calendar_id":null,"daily_liquidity":false,"instrument_code":"CDB1","redeemable_from":null}`
	if string(got[0].Rows[0]) != want || string(got[1].Rows[0]) != `{"source":"fixed"}` {
		t.Fatalf("tables = %s %s", got[0].Rows[0], got[1].Rows[0])
	}

	if ArchiveVersion < 19 {
		t.Fatalf("ArchiveVersion = %d, want at least 19", ArchiveVersion)
	}
}

// Fixed income complete A236, ADR 021 V2: a version 19 instrument row gains books_id and the
// issuer columns.
func TestAddInstrumentOwner(t *testing.T) {
	t.Parallel()

	v19 := []ArchiveTable{
		{Name: "marketdata_instrument", Rows: [][]byte{[]byte(`{"code":"CDB1"}`)}},
		{Name: "planning_budget_reference", Rows: [][]byte{[]byte(`{"source":"fixed"}`)}},
	}

	got, err := addInstrumentOwner(v19)
	if err != nil {
		t.Fatal(err)
	}

	want := `{"books_id":null,"code":"CDB1","issuer":null,"issuer_id":null,"issuer_scheme":null}`
	if string(got[0].Rows[0]) != want || string(got[1].Rows[0]) != `{"source":"fixed"}` {
		t.Fatalf("tables = %s %s", got[0].Rows[0], got[1].Rows[0])
	}

	if ArchiveVersion < 20 {
		t.Fatalf("ArchiveVersion = %d, want at least 20", ArchiveVersion)
	}
}

// Fixed income complete A236 FC6, ADR 021 V2: a version 20 archive has no payments, and every
// table carries over unchanged.
func TestAddFixedIncomePayments(t *testing.T) {
	t.Parallel()

	v20 := []ArchiveTable{
		{
			Name: "marketdata_fixed_income_terms",
			Rows: [][]byte{[]byte(`{"instrument_code":"CDB1"}`)},
		},
	}

	got, err := addFixedIncomePayments(v20)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 1 || string(got[0].Rows[0]) != `{"instrument_code":"CDB1"}` {
		t.Fatalf("tables = %+v", got)
	}

	if ArchiveVersion < 21 {
		t.Fatalf("ArchiveVersion = %d, want at least 21", ArchiveVersion)
	}
}

// Income buckets A239, ADR 021 V2: a version 22 goal counts in the bucket that takes goals.
func TestAddGoalSavings(t *testing.T) {
	t.Parallel()

	v22 := []ArchiveTable{{Name: "planning_goal", Rows: [][]byte{[]byte(`{"name":"Trip"}`)}}}

	got, err := addGoalSavings(v22)
	if err != nil {
		t.Fatal(err)
	}

	if string(got[0].Rows[0]) != `{"counts_as_savings":false,"name":"Trip"}` {
		t.Fatalf("row = %s", got[0].Rows[0])
	}

	if ArchiveVersion < 23 {
		t.Fatalf("ArchiveVersion = %d, want at least 23", ArchiveVersion)
	}
}

func TestAddCardFace(t *testing.T) {
	t.Parallel()

	v23 := []ArchiveTable{
		{Name: "ledger_account", Rows: [][]byte{[]byte(`{"name":"Card"}`)}},
		{Name: "ledger_card", Rows: [][]byte{[]byte(`{"holder":"Ana"}`)}},
	}

	got, err := addCardFace(v23)
	if err != nil {
		t.Fatal(err)
	}

	wantAccount := `{"face_art":null,"face_brand":null,"face_chip":null,"face_color":null,` +
		`"face_orientation":null,"name":"Card"}`
	if string(got[0].Rows[0]) != wantAccount {
		t.Fatalf("account row = %s", got[0].Rows[0])
	}

	if string(got[1].Rows[0]) != `{"holder":"Ana","network":null}` {
		t.Fatalf("card row = %s", got[1].Rows[0])
	}

	if ArchiveVersion < 24 {
		t.Fatalf("ArchiveVersion = %d, want at least 24", ArchiveVersion)
	}
}
