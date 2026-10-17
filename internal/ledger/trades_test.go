package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type tradeOut struct {
	Side      string         `json:"side"`
	Quantity  map[string]any `json:"quantity"`
	UnitPrice string         `json:"unit_price"`
	Gross     map[string]any `json:"gross"`
	Fees      map[string]any `json:"fees"`
	Taxes     map[string]any `json:"taxes"`
	Cost      map[string]any `json:"cost"`
}

type tradeTx struct {
	ID       string       `json:"id"`
	Version  int          `json:"version"`
	Postings []postingOut `json:"postings"`
	Trade    *tradeOut    `json:"trade"`
}

func (f investFixture) trade(t *testing.T, side, date string, quantity int64, price string, fees int64) tradeTx {
	t.Helper()
	body := map[string]any{"account_id": f.mxrf11, "cash_account_id": f.cash, "side": side, "date": date, "quantity": units(quantity, "MXRF11"), "unit_price": price}
	if fees != 0 {
		body["fees"] = apitest.BRL(fees)
	}
	var out tradeTx
	r := f.h.Do(http.MethodPost, "/api/v1/trades", body)
	if r.Status != http.StatusCreated {
		t.Fatalf("trade %s %s: %d %s", side, date, r.Status, r.Body)
	}
	r.Decode(t, &out)
	return out
}

func expectPostings(t *testing.T, got []postingOut, want ...[3]any) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("postings = %+v", got)
	}
	for i, w := range want {
		amount, _ := amountOf(got[i])
		if got[i].AccountID != w[0] || amount != w[1] || got[i].Weight["amount"] != float64(w[2].(int64)) {
			t.Fatalf("posting %d = %+v, want %v", i, got[i], w)
		}
	}
}

func TestS21PurchaseAndSale(t *testing.T) {
	f := newInvestFixture(t)
	gains := systemAccount(t, f.h, "realized_gains")

	buy := f.trade(t, "buy", "2026-10-05", 150, "10.05", 490)
	expectPostings(t, buy.Postings, [3]any{f.cash, int64(-151240), int64(-151240)}, [3]any{f.mxrf11, int64(150), int64(151240)})
	if buy.Trade == nil || buy.Trade.Side != "buy" || buy.Trade.Gross["amount"] != float64(150750) || buy.Trade.Fees["amount"] != float64(490) || buy.Trade.Cost != nil || buy.Trade.UnitPrice != "10.05" {
		t.Fatalf("buy detail = %+v", buy.Trade)
	}

	sell := f.trade(t, "sell", "2026-10-20", 50, "10.80", 210)
	expectPostings(t, sell.Postings,
		[3]any{f.cash, int64(53790), int64(53790)}, [3]any{f.mxrf11, int64(-50), int64(-50413)}, [3]any{gains, int64(-3377), int64(-3377)})
	var read tradeTx
	f.h.MustDo(http.MethodGet, "/api/v1/transactions/"+sell.ID, nil, http.StatusOK, &read)
	if read.Trade == nil || read.Trade.Cost["amount"] != float64(50413) || read.Trade.Quantity["amount"] != float64(50) || read.Trade.Taxes["amount"] != float64(0) {
		t.Fatalf("sale detail = %+v", read.Trade)
	}
}

// Review Focus 2.
func TestFullSaleLeavesNoCost(t *testing.T) {
	f := newInvestFixture(t)
	f.trade(t, "buy", "2026-10-05", 150, "10.05", 490)
	f.trade(t, "sell", "2026-10-20", 50, "10.80", 210)

	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id": f.mxrf11, "cash_account_id": f.cash, "side": "sell", "date": "2026-10-21", "quantity": units(101, "MXRF11"), "unit_price": "10",
	}), http.StatusUnprocessableEntity, "validation_failed", "quantity")
	all := f.trade(t, "sell", "2026-10-21", 100, "10", 0)
	if all.Trade.Cost["amount"] != float64(100827) {
		t.Fatalf("full sale cost = %+v", all.Trade.Cost)
	}
	f.trade(t, "buy", "2026-10-22", 10, "9.00", 0)
	half := f.trade(t, "sell", "2026-10-23", 5, "9.00", 0)
	if half.Trade.Cost["amount"] != float64(4500) || len(half.Postings) != 2 {
		t.Fatalf("sale after a full sale = %+v", half)
	}
}

func TestTradeValidation(t *testing.T) {
	f := newInvestFixture(t)
	h := f.h
	other := h.Account("Other broker", "asset", "brokerage", map[string]any{"institution_id": f.institution})
	otherCash := h.Account("Other cash", "asset", "brokerage", map[string]any{"institution_id": f.institution, "parent_id": other})
	order := func(k string, v any) map[string]any {
		body := map[string]any{"account_id": f.mxrf11, "cash_account_id": f.cash, "side": "buy", "date": "2026-10-05", "quantity": units(10, "MXRF11"), "unit_price": "10"}
		body[k] = v
		return body
	}
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/trades", order("taxes", apitest.BRL(100))), http.StatusUnprocessableEntity, "validation_failed", "taxes")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/trades", order("cash_account_id", otherCash)), http.StatusUnprocessableEntity, "validation_failed", "cash_account_id")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/trades", order("account_id", f.cash)), http.StatusUnprocessableEntity, "validation_failed", "account_id")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/trades", order("quantity", units(10, "PETR4"))), http.StatusUnprocessableEntity, "validation_failed", "quantity")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/trades", order("unit_price", "0")), http.StatusUnprocessableEntity, "validation_failed", "unit_price")
}

// Review Focus 1 and P8 amendment A69.
func TestLaterSaleLocksEarlierPostings(t *testing.T) {
	f := newInvestFixture(t)
	h := f.h
	buy := f.trade(t, "buy", "2026-10-05", 150, "10.05", 490)
	sell := f.trade(t, "sell", "2026-10-20", 50, "10.80", 210)

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id": f.mxrf11, "cash_account_id": f.cash, "side": "buy", "date": "2026-10-15", "quantity": units(10, "MXRF11"), "unit_price": "10",
	}), http.StatusConflict, "later_sale_exists", "")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/transactions/"+buy.ID+"/void", map[string]string{"reason": "typo"}), http.StatusConflict, "later_sale_exists", "")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/transactions", map[string]any{"date": "2026-10-20", "description": "bonus", "postings": []map[string]any{
		{"account_id": f.mxrf11, "amount": units(1, "MXRF11"), "weight": apitest.BRL(1000)},
		apitest.Posting(f.cash, -1000),
	}}), http.StatusConflict, "later_sale_exists", "")
	h.ExpectProblem(h.Do(http.MethodPut, "/api/v1/transactions/"+sell.ID, map[string]any{
		"expected_version": sell.Version, "date": "2026-10-20", "description": "edit", "reason": "edit",
		"postings": []map[string]any{apitest.Posting(f.cash, 100), apitest.Posting(f.travel, -100)},
	}), http.StatusConflict, "investment_transaction", "")

	var read tradeTx
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+sell.ID, nil, http.StatusOK, &read)
	if read.Trade.Cost["amount"] != float64(50413) {
		t.Fatalf("sale cost changed: %+v", read.Trade)
	}
	h.MustDo(http.MethodPost, "/api/v1/transactions/"+sell.ID+"/void", map[string]string{"reason": "wrong"}, http.StatusOK, nil)
	h.MustDo(http.MethodPost, "/api/v1/transactions/"+buy.ID+"/void", map[string]string{"reason": "typo"}, http.StatusOK, nil)
}
