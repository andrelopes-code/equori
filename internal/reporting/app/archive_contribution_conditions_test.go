package app

import "testing"

// A version 35 archive holds no condition column; the step gives every row the default of
// migration 00156 and keeps the input (CO1, CO3, CO7, CO8, CO15).
func TestAddContributionConditions(t *testing.T) {
	t.Parallel()

	v35 := []ArchiveTable{
		{Name: "portfolio_contribution_plan", Rows: [][]byte{[]byte(`{"amount":null}`)}},
		{Name: "portfolio_contribution_question", Rows: [][]byte{[]byte(`{"position":0}`)}},
		{Name: "portfolio_contribution_answer", Rows: [][]byte{[]byte(`{"yes":true}`)}},
		{Name: "portfolio_contribution_member", Rows: [][]byte{[]byte(`{"position":0}`)}},
		{Name: "ledger_account", Rows: [][]byte{[]byte(`{"name":"XP"}`)}},
	}
	want := []string{
		`{"amount":null,"revision":1}`,
		`{"effect":"weigh","position":0,"review_months":0}`,
		`{"answered_on":null,"overrides":false,"yes":true}`,
		`{"position":0,"release_month":null}`,
		`{"name":"XP"}`,
	}

	got, err := addContributionConditions(v35)
	if err != nil {
		t.Fatal(err)
	}

	for i, table := range got {
		if string(table.Rows[0]) != want[i] {
			t.Errorf("%s = %s, want %s", table.Name, table.Rows[0], want[i])
		}
	}

	if string(v35[0].Rows[0]) != `{"amount":null}` {
		t.Fatalf("the step changed its input: %s", v35[0].Rows[0])
	}

	if ArchiveVersion != 36 {
		t.Fatalf("ArchiveVersion = %d, want 36", ArchiveVersion)
	}
}
