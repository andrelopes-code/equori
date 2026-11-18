package ledger_test

import (
	"testing"
)

// TestRecordCorporateActionToolS431 records the split of S431 through the tool: 100 PETR4 at
// 1 for 10 become 1000.
func TestRecordCorporateActionToolS431(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})
	args := map[string]any{
		"account_id": f.petr4,
		"kind":       "split",
		"date":       "2026-11-10",
		"ratio_from": 1,
		"ratio_to":   10,
	}

	p := previewTool(t, f.h, "record_corporate_action", args)

	if p.Action != "record_corporate_action.split" || p.Target != "XP PETR4" ||
		p.Changes[0].After.Text != "1 : 10" {
		t.Fatalf("preview = %+v", p)
	}

	var out investmentOut
	toolOutput(t, f.h, "record_corporate_action", args, &out)

	var read actionTx
	f.h.MustDo("GET", "/api/v1/transactions/"+out.TransactionID, nil, 200, &read)

	expectPostings(
		t,
		read.Postings,
		[3]any{f.petr4, int64(-100), int64(-100000)},
		[3]any{f.petr4, int64(1000), int64(100000)},
	)
}

// TestRecordCorporateActionToolUnitTax cancels 12.500000 of 1000.000000 fund units for 150.00 of
// income tax, the figures of the unit tax scenario.
func TestRecordCorporateActionToolUnitTax(t *testing.T) {
	t.Parallel()
	f := newFundFixture(t)
	f.buyFund(t, "2026-05-04")
	args := map[string]any{
		"account_id": f.fund,
		"kind":       "unit_tax",
		"date":       "2026-05-29",
		"quantity":   "12.5",
		"amount":     "150.00",
	}

	var out investmentOut
	toolOutput(t, f.h, "record_corporate_action", args, &out)

	var read actionTx
	f.h.MustDo("GET", "/api/v1/transactions/"+out.TransactionID, nil, 200, &read)

	expectPostings(
		t,
		read.Postings,
		[3]any{f.fund, int64(-1000000000), int64(-1000000)},
		[3]any{f.fund, int64(987500000), int64(1000000)},
		[3]any{systemAccount(t, f.h, "prepaid_tax"), int64(15000), int64(15000)},
		[3]any{systemAccount(t, f.h, "adjustments"), int64(-15000), int64(-15000)},
	)
}

func TestRecordCorporateActionToolErrors(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})
	args := func(extra map[string]any) map[string]any {
		m := map[string]any{
			"account_id": f.petr4,
			"kind":       "split",
			"date":       "2026-11-10",
			"ratio_from": 1,
			"ratio_to":   10,
		}
		for k, v := range extra {
			m[k] = v
		}

		return m
	}

	f.h.ExpectToolError(
		f.h.Tool("record_corporate_action", args(map[string]any{"unit_cost": "x"})),
		"invalid_arguments",
		"unit_cost",
	)
	f.h.ExpectToolError(
		f.h.Tool("record_corporate_action", args(map[string]any{"quantity": "1"})),
		"invalid_arguments",
		"quantity",
	)
	f.h.ExpectToolError(
		f.h.Tool("record_corporate_action", args(map[string]any{"ratio_to": 1})),
		"validation_failed",
		"ratio_to",
	)
}
