package reporting_test

import (
	"encoding/json"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type toolRatio struct {
	BP     *int64 `json:"bp"`
	Reason string `json:"reason"`
}

type toolIndicatorMonth struct {
	Month       string     `json:"month"`
	Income      tool.Money `json:"income"`
	SavingsRate toolRatio  `json:"savings_rate"`
	Liquidity   toolRatio  `json:"liquidity"`
}

// S156 through the tool: the current month when no month is given.
func TestFinancialIndicatorsTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-20"))
	salaryBooks(h)
	r := h.Tool("get_financial_indicators", map[string]any{})
	if r.IsError {
		t.Fatalf("get_financial_indicators = error %s", r.Content)
	}
	var out struct {
		Months []toolIndicatorMonth `json:"months"`
	}
	if err := json.Unmarshal(r.Content, &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Months) != 12 {
		t.Fatalf("months = %s", r.Content)
	}
	last := out.Months[11]
	if last.Month != "2026-10" || last.Income != (tool.Money{Amount: "5000.00", Currency: "BRL"}) ||
		last.SavingsRate.BP == nil || *last.SavingsRate.BP != 10000 || last.Liquidity.Reason != "no_expense" {
		t.Fatalf("last month = %+v", last)
	}
	h.ExpectToolError(h.Tool("get_financial_indicators", map[string]any{"month": "2026-11"}), "invalid_request", "month")
}
