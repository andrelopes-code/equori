package reporting_test

import (
	"encoding/json"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type toolStatementParts struct {
	StatementID  string     `json:"statement_id"`
	Reference    string     `json:"reference"`
	Purchases    tool.Money `json:"purchases"`
	Installments tool.Money `json:"installments"`
	Charges      tool.Money `json:"charges"`
	Credits      tool.Money `json:"credits"`
	Total        tool.Money `json:"total"`
	Categories   []struct {
		CategoryName string     `json:"category_name"`
		Total        tool.Money `json:"total"`
	} `json:"categories"`
}

func statementAnalyticsTool(
	t *testing.T,
	h *apitest.Harness,
	args map[string]any,
) []toolStatementParts {
	t.Helper()

	r := h.Tool("get_statement_analytics", args)
	if r.IsError {
		t.Fatalf("get_statement_analytics = %s", r.Content)
	}

	var out struct {
		Statements []toolStatementParts `json:"statements"`
	}
	if err := json.Unmarshal(r.Content, &out); err != nil {
		t.Fatal(err)
	}

	return out.Statements
}

// TestStatementAnalyticsToolS148 reads the split of the statement 2026-12 of S148 without the
// refund and the fee of that scenario: the second installment of the electronics purchase.
func TestStatementAnalyticsToolS148(t *testing.T) {
	t.Parallel()
	c := newCard(t)
	c.h.Record("2026-11-20", apitest.Posting(c.card, -15000), apitest.Posting(c.supermarket, 15000))
	december := c.statementID(t, "2026-12")

	one := statementAnalyticsTool(t, c.h, map[string]any{"statement_id": december})
	if len(one) != 1 || one[0].StatementID != december || one[0].Reference != "2026-12" ||
		one[0].Purchases.Amount != "150.00" || one[0].Installments.Amount != "333.33" ||
		one[0].Total.Amount != "483.33" {
		t.Fatalf("statement = %+v", one)
	}

	totals := map[string]string{}
	for _, row := range one[0].Categories {
		totals[row.CategoryName] = row.Total.Amount
	}

	if len(totals) != 2 || totals["Supermarket"] != "150.00" || totals["Electronics"] != "333.33" {
		t.Fatalf("categories = %v", totals)
	}

	var byCard toolStatementParts
	for _, s := range statementAnalyticsTool(t, c.h, map[string]any{"account_id": c.card}) {
		if s.Reference == "2026-12" {
			byCard = s
		}
	}

	if byCard.StatementID != december || byCard.Total.Amount != "483.33" ||
		len(byCard.Categories) != 0 {
		t.Fatalf("statement 2026-12 of the card = %+v", byCard)
	}

	c.h.ExpectToolError(
		c.h.Tool("get_statement_analytics", map[string]any{}),
		"invalid_arguments",
		"statement_id",
	)
	c.h.ExpectToolError(
		c.h.Tool("get_statement_analytics", map[string]any{
			"statement_id": december, "account_id": c.card,
		}),
		"invalid_arguments",
		"account_id",
	)
}
