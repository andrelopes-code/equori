package app

import "testing"

// A version 37 archive holds no opening loss; the step keeps every table (S766, investment
// history EX1).
func TestAddOpeningLosses(t *testing.T) {
	t.Parallel()

	v37 := []ArchiveTable{
		{Name: "portfolio_contribution_plan", Rows: [][]byte{[]byte(`{"revision":1}`)}},
	}

	got, err := addOpeningLosses(v37)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 1 || got[0].Name != "portfolio_contribution_plan" ||
		string(got[0].Rows[0]) != `{"revision":1}` {
		t.Fatalf("the step changed the tables: %+v", got)
	}
}
