package app

import (
	"strings"
	"testing"
)

// Version 30: the terms gain an empty list of steps, and a corporate action keeps the exchange
// columns it holds or gets them as null.
func TestAddRateSteps(t *testing.T) {
	t.Parallel()

	tables := []ArchiveTable{
		{
			Name: "marketdata_fixed_income_terms",
			Rows: [][]byte{[]byte(`{"instrument_code":"CDB1"}`)},
		},
		{Name: "ledger_corporate_action", Rows: [][]byte{
			[]byte(`{"kind":"split"}`),
			[]byte(`{"kind":"spin_off","cost_bp":2500,"new_account_id":"a1"}`),
		}},
	}

	out, err := addRateSteps(tables)
	if err != nil {
		t.Fatal(err)
	}

	for want, row := range map[string][]byte{
		`"rate_steps":[]`:         out[0].Rows[0],
		`"rate_steps_apply":null`: out[0].Rows[0],
		`"cost_bp":null`:          out[1].Rows[0],
		`"cost_bp":2500`:          out[1].Rows[1],
		`"new_account_id":"a1"`:   out[1].Rows[1],
	} {
		if !strings.Contains(string(row), want) {
			t.Errorf("row %s, want %s", row, want)
		}
	}
}
