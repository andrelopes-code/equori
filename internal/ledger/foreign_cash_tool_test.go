package ledger_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// S767 (FC17): record_investment takes exchange_rate, previews it with the gross in the cash
// currency and the cost in the base currency, then records the trade at that rate.
func TestForeignCashThroughAssistant(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)
	args := map[string]any{
		"kind": "buy", "brokerage_id": f.brokerage, "instrument": "VOO",
		"cash_account_id": f.cash, "date": "2026-03-03", "quantity": "10",
		"unit_price": "500.00", "fees": "1.00", "exchange_rate": "5.20",
	}

	p := previewTool(t, f.h, "record_investment", args)

	want := map[string]string{
		"exchange_rate": "5.20",
		"amount":        "5000.00 USD",
		"base_amount":   "26005.20 BRL",
	}
	for field, value := range want {
		if got := changeText(p.Changes, field); got != value {
			t.Errorf("change %s = %q, want %q (changes %+v)", field, got, value, p.Changes)
		}
	}

	var out investmentOut
	toolOutput(t, f.h, "record_investment", args, &out)

	f.expectRows(t, tradeRowSQL, "buy 2600000 520 0 0 0 0 BRL 5.200000000000")
}

// FC17: record_brokerage_note and record_fixed_income take exchange_rate and preview the base
// amount.
func TestForeignCashNoteAndFixedIncomeThroughAssistant(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)

	note := previewTool(t, f.h, "record_brokerage_note", map[string]any{
		"brokerage_id": f.brokerage, "cash_account_id": f.cash, "date": "2026-03-03",
		"fees": "2.00", "exchange_rate": "5.20",
		"orders": []map[string]any{
			{"side": "buy", "instrument": "VOO", "quantity": "10", "unit_price": "500.00"},
		},
	})
	fixed := previewTool(t, f.h, "record_fixed_income", map[string]any{
		"brokerage_id": f.brokerage, "cash_account_id": f.cash, "applied_on": "2026-03-03",
		"amount": "1000.00", "exchange_rate": "5.20", "issuer": "Bank X",
		"subtype": "cdb", "matures_on": "2028-03-03", "index_id": "cdi",
		"percent_of_index": "110",
	})

	for name, c := range map[string]struct {
		changes []tool.Change
		want    string
	}{
		"note":  {note.Changes, "26010.40 BRL"},
		"fixed": {fixed.Changes, "5200.00 BRL"},
	} {
		if got := changeText(c.changes, "base_amount"); got != c.want {
			t.Errorf("%s base_amount = %q, want %q", name, got, c.want)
		}

		if got := changeText(c.changes, "exchange_rate"); got != "5.20" {
			t.Errorf("%s exchange_rate = %q, want 5.20", name, got)
		}
	}
}

func changeText(changes []tool.Change, field string) string {
	for _, c := range changes {
		if c.Field != field {
			continue
		}

		if c.After.Amount != "" {
			return c.After.Amount + " " + c.After.Currency
		}

		return c.After.Text
	}

	return ""
}
