package ledger_test

import (
	"net/http"
	"testing"
)

// Coverage row E-07 (assistant parity design, phase 6): a merger or a ticker change exchanges the
// whole holding for units of another security, and the cost of the holding moves whole to them.
func TestConversionMovesTheCost(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("PETR9", "stock"),
		http.StatusCreated,
		nil,
	)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})

	var tx actionTx
	f.h.MustDo(http.MethodPost, "/api/v1/corporate-actions", map[string]any{
		"account_id":     f.petr4,
		"kind":           "conversion",
		"date":           "2026-11-10",
		"ratio_from":     2,
		"ratio_to":       1,
		"new_instrument": "PETR9",
	}, http.StatusCreated, &tx)

	petr9 := holdingOf(t, f, "PETR9")
	expectPostings(
		t,
		tx.Postings,
		[3]any{f.petr4, int64(-100), int64(-100000)},
		[3]any{petr9, int64(50), int64(100000)},
	)

	if tx.CorporateAction == nil || tx.CorporateAction.Kind != "conversion" {
		t.Errorf("corporate action = %+v, want conversion", tx.CorporateAction)
	}

	// The portfolio holds the new security at the whole cost, and no unit of the old one.
	f.h.Dispatch()

	var positions struct {
		Items []struct {
			Instrument string `json:"instrument"`
			CostBasis  struct {
				Amount int64 `json:"amount"`
			} `json:"cost_basis"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/positions?date=2026-11-10", nil, http.StatusOK, &positions)

	if len(positions.Items) != 1 || positions.Items[0].Instrument != "PETR9" ||
		positions.Items[0].CostBasis.Amount != 100000 {
		t.Errorf("positions = %+v, want PETR9 at a cost of 1,000.00", positions.Items)
	}

	// The table refuses an exchange without its new holding, and a spin-off without its cost.
	for _, update := range []string{
		`UPDATE ledger_corporate_action SET new_account_id = NULL WHERE transaction_id = $1`,
		`UPDATE ledger_corporate_action SET kind = 'spin_off' WHERE transaction_id = $1`,
		`UPDATE ledger_corporate_action SET cost_bp = 10000 WHERE transaction_id = $1`,
	} {
		if _, err := f.h.Pool.Exec(t.Context(), update, tx.ID); err == nil {
			t.Errorf("%s: no error, want a check violation", update)
		}
	}
}

// Coverage row E-07: a spin-off keeps the holding, receives units of the new company, and moves
// to them the share of the cost the company's notice states (cost_percent).
func TestSpinOffToolSplitsTheCost(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("NOVA3", "stock"),
		http.StatusCreated,
		nil,
	)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})

	args := map[string]any{
		"account_id":     f.petr4,
		"kind":           "spin_off",
		"date":           "2026-11-10",
		"ratio_from":     10,
		"ratio_to":       1,
		"new_instrument": "NOVA3",
		"cost_percent":   "25",
	}

	p := previewTool(t, f.h, "record_corporate_action", args)
	if p.Action != "record_corporate_action.spin_off" {
		t.Fatalf("preview = %+v", p)
	}

	var out investmentOut
	toolOutput(t, f.h, "record_corporate_action", args, &out)

	var tx actionTx
	f.h.MustDo(http.MethodGet, "/api/v1/transactions/"+out.TransactionID, nil, http.StatusOK, &tx)

	nova3 := holdingOf(t, f, "NOVA3")
	expectPostings(
		t,
		tx.Postings,
		[3]any{f.petr4, int64(-100), int64(-100000)},
		[3]any{f.petr4, int64(100), int64(75000)},
		[3]any{nova3, int64(10), int64(25000)},
	)

	for _, bad := range []map[string]any{
		{"account_id": f.petr4, "kind": "spin_off", "date": "2026-11-11", "ratio_from": 10, "ratio_to": 1, "new_instrument": "NOVA3"},
		{"account_id": f.petr4, "kind": "spin_off", "date": "2026-11-11", "ratio_from": 10, "ratio_to": 1, "new_instrument": "NOVA3", "cost_percent": "100"},
		{"account_id": f.petr4, "kind": "conversion", "date": "2026-11-11", "ratio_from": 1, "ratio_to": 1},
		{"account_id": f.petr4, "kind": "conversion", "date": "2026-11-11", "ratio_from": 1, "ratio_to": 1, "new_instrument": "PETR4"},
	} {
		if r := f.h.Tool("record_corporate_action", bad); !r.IsError {
			t.Errorf("record_corporate_action %v = %s, want an error", bad, r.Content)
		}
	}
}

// holdingOf returns the holding account of code under the brokerage of the fixture.
func holdingOf(t *testing.T, f investFixture, code string) string {
	t.Helper()

	rows := f.h.Rows(
		`SELECT id::text FROM ledger_account WHERE parent_id = $1 AND instrument = $2`,
		f.xp,
		code,
	)
	if len(rows) != 1 {
		t.Fatalf("holdings of %s = %v, want one", code, rows)
	}

	return rows[0]
}
