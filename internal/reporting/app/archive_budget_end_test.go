package app

import "testing"

// A version 36 archive holds no budget end; the step marks every budget version as not ended and
// keeps the input (S752; budget end E22).
func TestAddBudgetEnded(t *testing.T) {
	t.Parallel()

	v36 := []ArchiveTable{
		{Name: "planning_budget_amount", Rows: [][]byte{[]byte(`{"amount":42800}`)}},
		{Name: "planning_budget", Rows: [][]byte{[]byte(`{"rollover":false}`)}},
	}
	want := []string{`{"amount":42800,"ended":false}`, `{"rollover":false}`}

	got, err := addBudgetEnded(v36)
	if err != nil {
		t.Fatal(err)
	}

	for i, table := range got {
		if string(table.Rows[0]) != want[i] {
			t.Errorf("%s = %s, want %s", table.Name, table.Rows[0], want[i])
		}
	}

	if string(v36[0].Rows[0]) != `{"amount":42800}` {
		t.Fatalf("the step changed its input: %s", v36[0].Rows[0])
	}
}
