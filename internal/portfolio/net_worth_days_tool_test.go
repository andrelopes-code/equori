package portfolio_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// TestNetWorthDaysToolS283 reads the three days of S283 through the tool.
func TestNetWorthDaysToolS283(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	checking := f.h.Account("Nubank", "asset", "checking", nil)
	loan := f.h.Account("Loan", "liability", "loan", nil)
	food := f.h.Account("Food", "expense", "", nil)
	f.h.Record("2026-10-01", f.h.Posting(checking, 100000), f.h.Posting(f.dividends, -100000))
	f.h.Record("2026-10-20", f.h.Posting(food, 30000), f.h.Posting(loan, -30000))
	f.h.Dispatch()

	var out struct {
		Days []struct {
			Date        string     `json:"date"`
			Assets      tool.Money `json:"assets"`
			Liabilities tool.Money `json:"liabilities"`
			Net         tool.Money `json:"net"`
		} `json:"days"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{
		"view": "net_worth_days", "from": "2026-10-19", "to": "2026-10-21",
	}, &out)

	want := []struct{ date, liabilities, net string }{
		{"2026-10-19", "0.00", "1000.00"},
		{"2026-10-20", "300.00", "700.00"},
		{"2026-10-21", "300.00", "700.00"},
	}
	if len(out.Days) != len(want) {
		t.Fatalf("days = %+v", out.Days)
	}

	for i, w := range want {
		got := out.Days[i]
		if got.Date != w.date || got.Assets.Amount != "1000.00" ||
			got.Liabilities.Amount != w.liabilities || got.Net.Amount != w.net {
			t.Fatalf("day %d = %+v, want %+v", i, got, w)
		}
	}

	f.h.ExpectToolError(
		f.h.Tool("get_portfolio", map[string]any{"view": "net_worth_days", "from": "2026-10-19"}),
		"invalid_arguments",
		"to",
	)
}
