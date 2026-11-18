package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S631 (coverage row E-08): an amortization of an FII, or a reduction of the capital of a
// company, returns cash and lowers the cost of the holding; its units stay.
func TestCapitalReturnLowersTheCost(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})

	var tx actionTx
	f.h.MustDo(http.MethodPost, "/api/v1/corporate-actions", map[string]any{
		"account_id": f.petr4,
		"kind":       "capital_return",
		"date":       "2026-11-10",
		"ratio_from": 1,
		"ratio_to":   1,
		"amount":     apitest.BRL(20000),
	}, http.StatusCreated, &tx)

	expectPostings(
		t,
		tx.Postings,
		[3]any{f.petr4, int64(-100), int64(-100000)},
		[3]any{f.petr4, int64(100), int64(80000)},
		[3]any{f.cash, int64(20000), int64(20000)},
	)

	if tx.CorporateAction == nil || tx.CorporateAction.Kind != "capital_return" {
		t.Errorf("corporate action = %+v, want capital_return", tx.CorporateAction)
	}

	// The cash returned may not exceed the cost of the holding.
	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, "/api/v1/corporate-actions", map[string]any{
			"account_id": f.petr4, "kind": "capital_return", "date": "2026-11-11",
			"ratio_from": 1, "ratio_to": 1, "amount": apitest.BRL(80000),
		}),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"amount",
	)

	if _, err := f.h.Pool.Exec(
		t.Context(),
		`UPDATE ledger_corporate_action SET value = 0 WHERE transaction_id = $1`,
		tx.ID,
	); err == nil {
		t.Error("a capital return of no value: no error, want a check violation")
	}
}

// S631: record_corporate_action records a capital return into the cash account of the brokerage.
func TestCapitalReturnTool(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})

	var out investmentOut
	toolOutput(t, f.h, "record_corporate_action", map[string]any{
		"account_id": f.petr4, "kind": "capital_return", "date": "2026-11-10", "amount": "200.00",
	}, &out)

	var tx actionTx
	f.h.MustDo(http.MethodGet, "/api/v1/transactions/"+out.TransactionID, nil, http.StatusOK, &tx)

	expectPostings(
		t,
		tx.Postings,
		[3]any{f.petr4, int64(-100), int64(-100000)},
		[3]any{f.petr4, int64(100), int64(80000)},
		[3]any{f.cash, int64(20000), int64(20000)},
	)
}
