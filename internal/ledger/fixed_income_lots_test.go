package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type lotSaleOut struct {
	ID    string `json:"id"`
	Trade struct {
		Cost struct {
			Amount int64 `json:"amount"`
		} `json:"cost"`
	} `json:"trade"`
}

// S447 (FL-S1): the sale of 5 units removes the cost of the oldest purchase.
func TestFixedIncomeSaleTakesTheOldestLot(t *testing.T) {
	t.Parallel()
	f := newLotFixture(t, "TDX", "fixed_income")
	f.trade(t, "buy", "2026-01-05", 10, "100.00")
	f.trade(t, "buy", "2026-02-05", 10, "120.00")

	sale := f.trade(t, "sell", "2026-03-05", 5, "130.00")

	if sale.Trade.Cost.Amount != 50000 {
		t.Fatalf("cost = %d, want 50000", sale.Trade.Cost.Amount)
	}
}

// S448 (FL-S2): the sale of 15 units removes the first purchase and half of the second.
func TestFixedIncomeSaleSpansLots(t *testing.T) {
	t.Parallel()
	f := newLotFixture(t, "TDX", "fixed_income")
	f.trade(t, "buy", "2026-01-05", 10, "100.00")
	f.trade(t, "buy", "2026-02-05", 10, "120.00")

	sale := f.trade(t, "sell", "2026-03-05", 15, "130.00")

	if sale.Trade.Cost.Amount != 160000 {
		t.Fatalf("cost = %d, want 160000", sale.Trade.Cost.Amount)
	}
}

// S449 (FL-S3): a stock keeps the average cost, 550.00 for 5 units.
func TestStockSaleKeepsTheAverageCost(t *testing.T) {
	t.Parallel()
	f := newLotFixture(t, "TDS", "stock")
	f.trade(t, "buy", "2026-01-05", 10, "100.00")
	f.trade(t, "buy", "2026-02-05", 10, "120.00")

	sale := f.trade(t, "sell", "2026-03-05", 5, "130.00")

	if sale.Trade.Cost.Amount != 55000 {
		t.Fatalf("cost = %d, want 55000", sale.Trade.Cost.Amount)
	}
}

type lotFixture struct {
	investFixture
	code, account string
}

func newLotFixture(t *testing.T, code, instrumentType string) lotFixture {
	t.Helper()

	f := newInvestFixture(t)
	body := security(code, instrumentType)
	delete(body, "exchange")
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", body, http.StatusCreated, nil)

	account := f.h.Account(
		"XP "+code,
		"asset",
		"brokerage",
		map[string]any{"institution_id": f.institution, "parent_id": f.xp, "currency": code},
	)

	return lotFixture{investFixture: f, code: code, account: account}
}

func (f lotFixture) trade(
	t *testing.T,
	side, date string,
	quantity int64,
	price string,
) lotSaleOut {
	t.Helper()

	var out lotSaleOut
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/trades",
		map[string]any{
			"account_id":      f.account,
			"cash_account_id": f.cash,
			"side":            side,
			"date":            date,
			"quantity":        units(quantity, f.code),
			"unit_price":      price,
		},
		http.StatusCreated,
		&out,
	)

	return out
}

// S450 (FL-S4): outside Brazil a fixed income sale keeps the average cost, 550.00 for 5 units.
func TestFixedIncomeOutsideBrazilKeepsTheAverage(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.As(apitest.Neutral()))
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "NZB", "type": "fixed_income", "scale": 0, "name": "NZB",
		"quote_currency": "NZD",
	}, http.StatusCreated, nil)

	var inst idOnly
	h.MustDo(http.MethodPost, "/api/v1/institutions",
		map[string]string{"name": "Broker"}, http.StatusCreated, &inst)

	broker := h.Account("Broker", "asset", "brokerage", map[string]any{"institution_id": inst.ID})
	child := func(name, currency string) string {
		return h.Account(name, "asset", "brokerage", map[string]any{
			"institution_id": inst.ID, "parent_id": broker, "currency": currency,
		})
	}
	cash, bond := child("Broker cash", "NZD"), child("Broker NZB", "NZB")

	trade := func(side, date string, quantity int64, price string) lotSaleOut {
		var out lotSaleOut
		h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
			"account_id": bond, "cash_account_id": cash, "side": side, "date": date,
			"quantity": units(quantity, "NZB"), "unit_price": price,
		}, http.StatusCreated, &out)

		return out
	}
	trade("buy", "2026-01-05", 10, "100.00")
	trade("buy", "2026-02-05", 10, "120.00")

	sale := trade("sell", "2026-03-05", 5, "130.00")

	if sale.Trade.Cost.Amount != 55000 {
		t.Fatalf("cost = %d, want 55000", sale.Trade.Cost.Amount)
	}
}

// S451 (FL-S5): a custody transfer keeps the lots; the sale of 10 units at the other brokerage removes
// the first purchase, 1,000.00, and not the average of the 15 units, 1,066.67.
func TestFixedIncomeTransferKeepsTheLots(t *testing.T) {
	t.Parallel()
	f := newLotFixture(t, "TDX", "fixed_income")
	f.trade(t, "buy", "2026-01-05", 10, "100.00")
	f.trade(t, "buy", "2026-02-05", 10, "120.00")

	other := f.h.Account("Broker B", "asset", "brokerage", nil)
	otherCash := f.h.Account("Broker B cash", "asset", "brokerage", map[string]any{
		"parent_id": other,
	})

	var moved actionTx
	f.h.MustDo(http.MethodPost, custodyPath, map[string]any{
		"account_id": f.account, "brokerage_id": other, "date": "2026-03-01",
		"quantity": units(15, f.code),
	}, http.StatusCreated, &moved)

	expectPostings(
		t,
		moved.Postings,
		[3]any{f.account, int64(-15), int64(-160000)},
		[3]any{moved.Postings[1].AccountID, int64(15), int64(160000)},
	)

	var sale lotSaleOut
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id": moved.Postings[1].AccountID, "cash_account_id": otherCash,
		"side": "sell", "date": "2026-03-05", "quantity": units(10, f.code),
		"unit_price": "130.00",
	}, http.StatusCreated, &sale)

	if sale.Trade.Cost.Amount != 100000 {
		t.Fatalf("cost = %d, want 100000", sale.Trade.Cost.Amount)
	}
}

// S453 (FL-S9): a correction of a sale that has a later sale of its day is refused for lots and for the
// average alike, so the later sale never reads lots its correction would change.
func TestSameDayCorrectionOfASaleIsRefused(t *testing.T) {
	t.Parallel()

	for _, instrumentType := range []string{"fixed_income", "stock"} {
		t.Run(instrumentType, func(t *testing.T) {
			t.Parallel()
			f := newLotFixture(t, "TDY", instrumentType)
			f.trade(t, "buy", "2026-01-05", 10, "100.00")
			f.trade(t, "buy", "2026-02-05", 10, "120.00")
			first := f.trade(t, "sell", "2026-03-05", 5, "130.00")
			f.trade(t, "sell", "2026-03-05", 5, "130.00")

			r := f.h.Do(http.MethodPut, "/api/v1/trades/"+first.ID, map[string]any{
				"expected_version": 1,
				"reason":           "wrong quantity",
				"trade": map[string]any{
					"account_id": f.account, "cash_account_id": f.cash, "side": "sell",
					"date": "2026-03-05", "quantity": units(4, f.code), "unit_price": "130.00",
				},
			})

			if r.Status != http.StatusConflict {
				t.Fatalf("status %d body %s, want %d", r.Status, r.Body, http.StatusConflict)
			}
		})
	}
}

// S452 (FL-S6): a purchase corrected after a sale that follows it is refused.
func TestPurchaseCorrectionBeforeALaterSaleIsRefused(t *testing.T) {
	t.Parallel()
	f := newLotFixture(t, "TDX", "fixed_income")
	first := f.trade(t, "buy", "2026-01-05", 10, "100.00")
	f.trade(t, "sell", "2026-03-01", 5, "130.00")

	r := f.h.Do(http.MethodPut, "/api/v1/trades/"+first.ID, map[string]any{
		"expected_version": 1,
		"reason":           "wrong quantity",
		"trade": map[string]any{
			"account_id": f.account, "cash_account_id": f.cash, "side": "buy",
			"date": "2026-01-05", "quantity": units(11, f.code), "unit_price": "100.00",
		},
	})

	if r.Status != http.StatusConflict {
		t.Fatalf("status %d body %s, want %d", r.Status, r.Body, http.StatusConflict)
	}
}

// S454 (FL-S8): lots that cannot give up the cost of a sale are an internal error and write no
// posting. A direct change of the cost of the first sale makes the oldest lot negative.
func TestInconsistentLotsFailTheSale(t *testing.T) {
	t.Parallel()
	f := newLotFixture(t, "TDX", "fixed_income")
	f.trade(t, "buy", "2026-01-05", 10, "100.00")
	f.trade(t, "buy", "2026-02-05", 10, "120.00")
	first := f.trade(t, "sell", "2026-03-05", 5, "130.00")

	// One statement keeps the transaction balanced: the cost grows by 1,000.00, the cash weight too.
	tag, err := f.h.Pool.Exec(
		t.Context(),
		`UPDATE ledger_posting
		SET weight = CASE WHEN account_id = $2 THEN -150000 ELSE weight + 100000 END
		WHERE transaction_id = $1 AND account_id IN ($2, $3)`,
		first.ID,
		f.account,
		f.cash,
	)
	if err != nil || tag.RowsAffected() != 2 {
		t.Fatalf("tamper: rows %d, error %v", tag.RowsAffected(), err)
	}

	before := f.h.Rows("SELECT count(*) FROM ledger_transaction")

	r := f.h.Do(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id": f.account, "cash_account_id": f.cash, "side": "sell",
		"date": "2026-03-06", "quantity": units(1, f.code), "unit_price": "130.00",
	})

	if r.Status != http.StatusInternalServerError {
		t.Fatalf("status %d body %s, want 500", r.Status, r.Body)
	}

	if after := f.h.Rows("SELECT count(*) FROM ledger_transaction"); after[0] != before[0] {
		t.Fatalf("transactions = %s, want %s", after[0], before[0])
	}
}
