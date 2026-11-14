package ledger_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type dayTradeOut struct {
	Cost             map[string]any `json:"cost"`
	DayTradeQuantity map[string]any `json:"day_trade_quantity"`
	DayTradeCost     map[string]any `json:"day_trade_cost"`
}

type dayTradeTx struct {
	ID       string       `json:"id"`
	Postings []postingOut `json:"postings"`
	Trade    dayTradeOut  `json:"trade"`
}

// A228 IO11, IO12: the 50 units sold close the 50 units bought the same day.
func TestS423DayTradeClosesTheDayPurchase(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.petr4Day(t, "buy", "2026-11-03", 100, "10.00")
	f.petr4Day(t, "buy", "2026-11-10", 50, "12.00")

	sale := f.petr4Day(t, "sell", "2026-11-10", 50, "13.00")

	expectDayTrade(t, sale, 60000, 50, 60000)
	f.expectHolding(t, 100, 100000)
}

// A228 IO12, IO13: 30 close the day's purchase, 20 come from the stock of 100 at 1000.00.
func TestS424DayTradeAndSwing(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.petr4Day(t, "buy", "2026-11-03", 100, "10.00")
	f.petr4Day(t, "buy", "2026-11-10", 30, "12.00")

	sale := f.petr4Day(t, "sell", "2026-11-10", 50, "13.00")

	expectDayTrade(t, sale, 56000, 30, 36000)
	f.expectHolding(t, 80, 80000)

	var corrected dayTradeTx
	f.h.MustDo(
		http.MethodPut,
		"/api/v1/trades/"+sale.ID,
		map[string]any{
			"expected_version": 1,
			"reason":           "wrong quantity",
			"trade":            f.petr4Body("sell", "2026-11-10", 40, "13.00"),
		},
		http.StatusOK,
		&corrected,
	)

	expectDayTrade(t, corrected, 46000, 30, 36000)
}

// A228 IO12: the first purchase pairs with the first sale.
func TestS425DayTradePairsInOrder(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.petr4Day(t, "buy", "2026-11-10", 10, "300.20")
	f.petr4Day(t, "buy", "2026-11-10", 5, "300.40")

	first := f.petr4Day(t, "sell", "2026-11-10", 10, "301.00")
	second := f.petr4Day(t, "sell", "2026-11-10", 5, "301.00")

	expectDayTrade(t, first, 300200, 10, 300200)
	expectDayTrade(t, second, 150200, 5, 150200)
	f.expectHolding(t, 0, 0)
}

// A228 IO16: a purchase after a sale of its day is a later sale.
func TestLaterSaleDetailNamesTheBrokerageNote(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.petr4Day(t, "buy", "2026-11-03", 100, "10.00")
	f.petr4Day(t, "sell", "2026-11-10", 50, "13.00")

	r := f.h.Do(http.MethodPost, "/api/v1/trades", f.petr4Body("buy", "2026-11-10", 5, "12.00"))
	if r.Status != http.StatusConflict || !strings.Contains(string(r.Body), "brokerage note") {
		t.Fatalf("status %d body %s", r.Status, r.Body)
	}
}

// A228 IO10: outside Brazil a sale keeps the average cost of the whole holding.
func TestS426OutsideBrazilKeepsTheAverage(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.As(apitest.Neutral()))
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "AIR", "type": "stock", "scale": 0, "name": "AIR",
		"quote_currency": "NZD", "exchange": "XNZE",
	}, http.StatusCreated, nil)

	var inst idOnly
	h.MustDo(http.MethodPost, "/api/v1/institutions",
		map[string]string{"name": "Broker"}, http.StatusCreated, &inst)

	extra := func(currency string, parent string) map[string]any {
		x := map[string]any{"institution_id": inst.ID}
		if parent != "" {
			x["parent_id"] = parent
			x["currency"] = currency
		}

		return x
	}
	broker := h.Account("Broker", "asset", "brokerage", extra("", ""))
	cash := h.Account("Broker cash", "asset", "brokerage", extra("NZD", broker))
	air := h.Account("Broker AIR", "asset", "brokerage", extra("AIR", broker))

	trade := func(side, date string, quantity int64, price string) dayTradeTx {
		var out dayTradeTx
		h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
			"account_id": air, "cash_account_id": cash, "side": side, "date": date,
			"quantity": units(quantity, "AIR"), "unit_price": price,
		}, http.StatusCreated, &out)

		return out
	}
	trade("buy", "2026-11-03", 100, "10.00")
	trade("buy", "2026-11-10", 50, "12.00")

	sale := trade("sell", "2026-11-10", 50, "13.00")

	expectDayTrade(t, sale, 53333, 0, 0)
}

func (f investFixture) petr4Day(
	t *testing.T,
	side, date string,
	quantity int64,
	price string,
) dayTradeTx {
	t.Helper()

	var out dayTradeTx
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/trades",
		f.petr4Body(side, date, quantity, price),
		http.StatusCreated,
		&out,
	)

	return out
}

func (f investFixture) petr4Body(
	side, date string,
	quantity int64,
	price string,
) map[string]any {
	return map[string]any{
		"account_id":      f.petr4,
		"cash_account_id": f.cash,
		"side":            side,
		"date":            date,
		"quantity":        units(quantity, "PETR4"),
		"unit_price":      price,
	}
}

// expectHolding checks the PETR4 quantity through the balance and the cost basis through the
// sum of the weights of its postings.
func (f investFixture) expectHolding(t *testing.T, quantity, basis int64) {
	t.Helper()

	var bal struct {
		Balance struct {
			Amount int64 `json:"amount"`
		} `json:"balance"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/accounts/"+f.petr4+"/balance?date=2026-11-30",
		nil,
		http.StatusOK,
		&bal,
	)

	if bal.Balance.Amount != quantity {
		t.Fatalf("holding = %d, want %d", bal.Balance.Amount, quantity)
	}

	var txs struct {
		Items []dayTradeTx `json:"items"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/transactions?account_id="+f.petr4+"&limit=100",
		nil,
		http.StatusOK,
		&txs,
	)

	var got float64
	for _, tx := range txs.Items {
		for _, p := range tx.Postings {
			if p.AccountID == f.petr4 {
				got += p.Weight["amount"].(float64)
			}
		}
	}

	if int64(got) != basis {
		t.Fatalf("cost basis = %v, want %d", got, basis)
	}
}

func expectDayTrade(t *testing.T, tx dayTradeTx, cost, dtQuantity, dtCost int64) {
	t.Helper()

	got := [3]any{
		tx.Trade.Cost["amount"], tx.Trade.DayTradeQuantity["amount"],
		tx.Trade.DayTradeCost["amount"],
	}
	if got != [3]any{float64(cost), float64(dtQuantity), float64(dtCost)} {
		t.Fatalf("cost, day-trade quantity, day-trade cost = %v, want %d, %d, %d",
			got, cost, dtQuantity, dtCost)
	}
}
