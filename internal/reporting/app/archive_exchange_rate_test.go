package app

import "testing"

// A version 38 archive holds no exchange rate on a trade or an income; the step sets it to null
// and keeps the input (S778; foreign cash FC22).
func TestAddExchangeRates(t *testing.T) {
	t.Parallel()

	v38 := []ArchiveTable{
		{Name: "ledger_trade", Rows: [][]byte{[]byte(`{"gross":2600000}`)}},
		{Name: "ledger_investment_income", Rows: [][]byte{[]byte(`{"gross":2000}`)}},
		{Name: "ledger_account", Rows: [][]byte{[]byte(`{"name":"Cash"}`)}},
	}
	want := []string{
		`{"exchange_rate":null,"gross":2600000}`,
		`{"exchange_rate":null,"gross":2000}`,
		`{"name":"Cash"}`,
	}

	got, err := addExchangeRates(v38)
	if err != nil {
		t.Fatal(err)
	}

	for i, table := range got {
		if string(table.Rows[0]) != want[i] {
			t.Errorf("%s = %s, want %s", table.Name, table.Rows[0], want[i])
		}
	}

	if string(v38[0].Rows[0]) != `{"gross":2600000}` {
		t.Fatalf("the step changed its input: %s", v38[0].Rows[0])
	}

	if ArchiveVersion != 39 {
		t.Fatalf("ArchiveVersion = %d, want 39", ArchiveVersion)
	}
}
