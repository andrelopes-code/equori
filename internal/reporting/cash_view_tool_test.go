package reporting_test

import (
	"encoding/json"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type toolCashTotals struct {
	Categories []struct {
		AccountID string     `json:"account_id"`
		Total     tool.Money `json:"total"`
	} `json:"categories"`
	Payments []struct {
		Date                 string     `json:"date"`
		Amount               tool.Money `json:"amount"`
		StatementID          string     `json:"statement_id"`
		PaymentTransactionID string     `json:"payment_transaction_id"`
	} `json:"payments"`
}

// TestCategoryTotalsToolCashS30 reads S30 paid in full through the tool: the cash view counts
// the card purchases in the month of the payment, and category_id lists the payment behind one.
func TestCategoryTotalsToolCashS30(t *testing.T) {
	t.Parallel()
	c := newCard(t)
	payment := c.pay(t, "2026-11", "2026-11-10", 56334)
	args := map[string]any{
		"class": "expense", "view": "cash", "from": "2026-11-01", "to": "2026-11-30",
		"category_id": c.supermarket,
	}

	r := c.h.Tool("get_category_totals", args)
	if r.IsError {
		t.Fatalf("get_category_totals = %s", r.Content)
	}

	var got toolCashTotals
	if err := json.Unmarshal(r.Content, &got); err != nil {
		t.Fatal(err)
	}

	totals := map[string]string{}
	for _, v := range got.Categories {
		totals[v.AccountID] = v.Total.Amount
	}

	if totals[c.supermarket] != "230.00" || totals[c.electronics] != "333.34" {
		t.Fatalf("cash totals = %v", totals)
	}

	if len(got.Payments) != 1 || got.Payments[0].Date != "2026-11-10" ||
		got.Payments[0].Amount.Amount != "230.00" || got.Payments[0].StatementID == "" ||
		got.Payments[0].PaymentTransactionID != payment {
		t.Fatalf("payments = %+v", got.Payments)
	}

	args["view"] = "accrual"
	c.h.ExpectToolError(c.h.Tool("get_category_totals", args), "invalid_arguments", "category_id")
}
