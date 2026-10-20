package portfolio_test

import (
	"net/http"
	"testing"
)

func TestPositionsFollowLedgerChanges(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	if ps := f.positions(t, "2026-10-01"); len(ps) != 0 {
		t.Fatalf("positions before any trade = %+v", ps)
	}
	f.trade(t, "buy", "2026-10-05", 150, "10.05", 490)
	sale := f.trade(t, "sell", "2026-10-20", 50, "10.80", 210)

	ps := f.positions(t, "2026-10-10")
	if len(ps) != 1 || ps[0].Quantity["amount"] != float64(150) || ps[0].MarketValue != nil || ps[0].Prices != nil {
		t.Fatalf("position without a price = %+v", ps)
	}
	f.h.Dispatch()
	if rs := f.results(t, "2026"); len(rs) != 1 {
		t.Fatalf("results = %+v", rs)
	}

	f.h.MustDo(http.MethodPost, "/api/v1/transactions/"+sale+"/void", map[string]string{"reason": "wrong"}, http.StatusOK, nil)
	if rs := f.results(t, "2026"); len(rs) != 0 {
		t.Fatalf("results after the void = %+v", rs)
	}
	if ps := f.positions(t, "2026-11-01"); len(ps) != 1 || ps[0].Quantity["amount"] != float64(150) {
		t.Fatalf("positions after the void = %+v", ps)
	}

	f.trade(t, "sell", "2026-10-21", 150, "10", 0)
	if ps := f.positions(t, "2026-11-01"); len(ps) != 0 {
		t.Fatalf("positions after a full sale = %+v", ps)
	}
	if ps := f.positions(t, "2026-10-20"); len(ps) != 1 {
		t.Fatalf("positions before the full sale = %+v", ps)
	}

	other := f.h.Login("other@example.com")
	var out struct {
		Items []positionOut `json:"items"`
	}
	r := f.h.Call(other, http.MethodGet, "/api/v1/positions?date=2026-10-20", nil)
	r.Decode(t, &out)
	if r.Status != http.StatusOK || len(out.Items) != 0 {
		t.Fatalf("another user's positions = %d %+v", r.Status, out.Items)
	}
	f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/realized-results?year=1800", nil), http.StatusBadRequest, "invalid_request", "")
}

// Final review: a holding below zero is listed without an average cost instead of failing.
func TestNegativeHoldingHasNoAverageCost(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.trade(t, "buy", "2026-10-05", 150, "10.05", 490)
	f.h.Record("2026-10-06",
		map[string]any{"account_id": f.mxrf11, "amount": units(-200, "MXRF11"), "weight": map[string]any{"amount": -100000, "currency": "BRL"}},
		map[string]any{"account_id": f.cash, "amount": map[string]any{"amount": 100000, "currency": "BRL"}},
	)
	ps := f.positions(t, "2026-10-10")
	if len(ps) != 1 || ps[0].Quantity["amount"] != float64(-50) || ps[0].CostBasis["amount"] != float64(51240) || ps[0].AverageCost != "" {
		t.Fatalf("positions = %+v", ps)
	}
}
