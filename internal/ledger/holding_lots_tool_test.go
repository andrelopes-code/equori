package ledger_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// TestGetHoldingLotsToolS455 reads the two lots of S455 through the tool.
func TestGetHoldingLotsToolS455(t *testing.T) {
	t.Parallel()
	f := newLotFixture(t, "TDX", "fixed_income")
	f.trade(t, "buy", "2026-01-05", 10, "100.00")
	f.trade(t, "buy", "2026-02-05", 10, "120.00")

	var got struct {
		Method               string     `json:"method"`
		EstimatesWithholding bool       `json:"estimates_withholding"`
		CostBasis            tool.Money `json:"cost_basis"`
		Lots                 []struct {
			AcquiredOn string     `json:"acquired_on"`
			Quantity   string     `json:"quantity"`
			Cost       tool.Money `json:"cost"`
		} `json:"lots"`
	}
	toolOutput(t, f.h, "get_holding_lots", map[string]any{
		"account_id": f.account, "date": "2026-03-05",
	}, &got)

	if got.Method != "fifo" || !got.EstimatesWithholding || got.CostBasis.Amount != "2200.00" ||
		len(got.Lots) != 2 {
		t.Fatalf("lots = %+v", got)
	}

	first, second := got.Lots[0], got.Lots[1]
	if first.AcquiredOn != "2026-01-05" || first.Quantity != "10" ||
		first.Cost.Amount != "1000.00" || second.AcquiredOn != "2026-02-05" ||
		second.Cost.Amount != "1200.00" {
		t.Fatalf("lots = %+v", got.Lots)
	}

	f.h.ExpectToolError(
		f.h.Tool("get_holding_lots", map[string]any{"account_id": "x"}),
		"invalid_arguments",
		"account_id",
	)
}
