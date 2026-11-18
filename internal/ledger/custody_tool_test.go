package ledger_test

import (
	"testing"
)

// TestTransferCustodyToolS436 moves 40 of the 100 PETR4 of S436 through the tool.
func TestTransferCustodyToolS436(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})
	brokerageB := f.h.Account("Corretora B", "asset", "brokerage", nil)
	args := map[string]any{
		"account_id":   f.petr4,
		"brokerage_id": brokerageB,
		"date":         "2026-11-10",
		"quantity":     "40",
	}

	p := previewTool(t, f.h, "transfer_custody", args)

	if p.Target != "XP PETR4" || p.Changes[0].After.Text != "Corretora B" ||
		p.Changes[1].After.Text != "40" {
		t.Fatalf("preview = %+v", p)
	}

	var out investmentOut
	toolOutput(t, f.h, "transfer_custody", args, &out)

	var moved int64
	for account, amount := range amountsByAccount(f.h.Transaction(out.TransactionID)) {
		if account == f.petr4 {
			moved = amount
		}
	}

	if moved != -40 {
		t.Fatalf("units leaving the giving holding = %d, want -40", moved)
	}
}

func TestTransferCustodyToolErrors(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})
	brokerageB := f.h.Account("Corretora B", "asset", "brokerage", nil)
	args := func(brokerage, quantity string) map[string]any {
		return map[string]any{
			"account_id":   f.petr4,
			"brokerage_id": brokerage,
			"date":         "2026-11-10",
			"quantity":     quantity,
		}
	}

	f.h.ExpectToolError(
		f.h.Tool("transfer_custody", args(brokerageB, "x")),
		"invalid_arguments",
		"quantity",
	)
	f.h.ExpectToolError(
		f.h.Tool("transfer_custody", args(brokerageB, "101")),
		"validation_failed",
		"quantity",
	)
	f.h.ExpectToolError(
		f.h.Tool("transfer_custody", args(f.xp, "40")),
		"validation_failed",
		"brokerage_id",
	)
}
