package ledger_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S759 (investment history AS1, AS2): record_investment proposes and records an opening: the
// preview lists the cost and the acquisition date, with no cash account and no settlement.
func TestS759OpeningThroughAssistant(t *testing.T) {
	t.Parallel()
	f := newOpeningFixture(t, apitest.Profiles()[0])
	args := map[string]any{
		"kind":         "opening",
		"brokerage_id": f.xp,
		"instrument":   "PETR4",
		"date":         "2021-03-10",
		"quantity":     "100",
		"unit_price":   "20.00",
		"fees":         "5.00",
	}

	p := previewTool(t, f.h, "record_investment", args)

	if p.Action != "record_investment.opening" {
		t.Fatalf("action = %q", p.Action)
	}

	got := map[string]string{}

	for _, c := range p.Changes {
		v := c.After.Text
		if v == "" {
			v = c.After.Amount
		}

		if v == "" {
			v = c.After.Date
		}

		got[c.Field] = v
	}

	want := map[string]string{
		"quantity": "100",
		"price":    "20.00",
		"fees":     "5.00",
		"amount":   "2000.00",
		"date":     "2021-03-10",
	}
	for field, value := range want {
		if got[field] != value {
			t.Errorf("change %s = %q, want %q (changes %+v)", field, got[field], value, p.Changes)
		}
	}

	for _, field := range []string{"account", "settlement", "net"} {
		if _, ok := got[field]; ok {
			t.Errorf("change %s present on an opening", field)
		}
	}

	var out investmentOut
	toolOutput(t, f.h, "record_investment", args, &out)

	rows := f.h.Rows(
		`SELECT side FROM ledger_trade WHERE transaction_id = $1`,
		out.TransactionID,
	)
	if len(rows) != 1 || rows[0] != "opening" {
		t.Fatalf("recorded side = %v, want opening", rows)
	}
}
