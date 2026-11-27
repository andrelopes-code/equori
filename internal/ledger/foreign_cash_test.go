package ledger_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type foreignCashFixture struct {
	h                                            *apitest.Harness
	brokerage, cash, eur, brl, brlCash, dividend string
}

const tradeRowSQL = `SELECT side, gross, fees, taxes, coalesce(cost, 0), day_trade_quantity,
	day_trade_cost, currency, coalesce(exchange_rate::text, 'null') FROM ledger_trade ORDER BY side`

// S767 (foreign cash FC1 to FC5): a purchase of VOO paid with Cash USD at a given rate posts the
// dollars in the cash account, weighs them in reais and stores the amounts in reais.
func TestS767PurchaseInDollars(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)

	r := f.buy("2026-03-03", "5.20")
	if r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	var tx struct {
		Trade struct {
			ExchangeRate string `json:"exchange_rate"`
		} `json:"trade"`
	}
	r.Decode(t, &tx)

	if tx.Trade.ExchangeRate != "5.2" {
		t.Fatalf("exchange_rate = %q, want 5.2", tx.Trade.ExchangeRate)
	}

	f.expectRows(t, tradeRowSQL, "buy 2600000 520 0 0 0 0 BRL 5.200000000000")
	f.expectRows(t, f.cashPostings(), "-500100 -2600520")
	f.expectRows(t, f.postingSQL("p.account_id = t.account_id"), "10 2600520")
	f.expectSum(t, f.cash, "499900")
}

// S768 (FC2): without exchange_rate the order takes the stored close on or before its date;
// without one it is refused.
func TestS768RateOfTheDay(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)

	f.h.ExpectProblem(
		f.buy("2026-03-03", ""),
		http.StatusUnprocessableEntity,
		"price_missing",
		"exchange_rate",
	)
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument": "USD", "quote_instrument": "BRL", "date": "2026-03-03", "value": "5.10",
	}, http.StatusCreated, nil)
	f.h.ExpectProblem(
		f.buy("2026-03-02", ""),
		http.StatusUnprocessableEntity,
		"price_missing",
		"exchange_rate",
	)

	if r := f.buy("2026-03-03", ""); r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	f.expectRows(t, tradeRowSQL, "buy 2550000 510 0 0 0 0 BRL 5.100000000000")
	f.expectRows(t, f.postingSQL("p.account_id = t.account_id"), "10 2550510")
}

// S769 (FC3, FC4, FC6): a sale paid in dollars removes the average cost in reais and separates no
// day trade.
func TestS769SaleInDollars(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)

	if r := f.buy("2026-03-03", "5.20"); r.Status != http.StatusCreated {
		t.Fatalf("buy status %d: %s", r.Status, r.Body)
	}

	r := f.h.Do(
		http.MethodPost,
		"/api/v1/trades",
		f.order("sell", "2026-09-01", 4, "600.00", "5.50"),
	)
	if r.Status != http.StatusCreated {
		t.Fatalf("sell status %d: %s", r.Status, r.Body)
	}

	f.expectRows(t, tradeRowSQL,
		"buy 2600000 520 0 0 0 0 BRL 5.200000000000",
		"sell 1320000 550 0 1040208 0 0 BRL 5.500000000000")
	f.expectRows(t, f.cashPostings(),
		"-500100 -2600520", "239900 1319450")
	f.expectSum(t, f.cash, "739800")
	f.expectSum(t, f.system(t, "realized_gains"), "-279242")
}

// S770 (FC3, FC4): a dividend paid in dollars books its gross and its withholding in reais.
func TestS770IncomeInDollars(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)

	if r := f.buy("2026-03-03", "5.20"); r.Status != http.StatusCreated {
		t.Fatalf("buy status %d: %s", r.Status, r.Body)
	}

	r := f.h.Do(http.MethodPost, "/api/v1/investment-income", map[string]any{
		"brokerage_id": f.brokerage, "instrument": "VOO", "cash_account_id": f.cash,
		"income_type": "dividend", "date": "2026-06-20", "category_id": f.dividend,
		"gross": usd(2000), "withheld": usd(600), "exchange_rate": "5.00",
	})
	if r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	f.expectRows(t,
		`SELECT gross, withheld, currency, exchange_rate::text FROM ledger_investment_income`,
		"10000 3000 BRL 5.000000000000")
	f.expectRows(t,
		`SELECT p.amount, p.weight FROM ledger_posting p
		JOIN ledger_investment_income i ON i.transaction_id = p.transaction_id
		WHERE p.account_id = '`+f.cash+`'`,
		"1400 7000")
}

// S771 (FC1): the cash is in the base currency or in the quote currency of the instrument.
func TestS771RefusedCash(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)

	body := f.order("buy", "2026-03-03", 10, "500.00", "5.20")
	body["cash_account_id"] = f.eur
	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, "/api/v1/trades", body),
		http.StatusUnprocessableEntity,
		"currency_unsupported",
		"cash_account_id",
	)

	petr4 := f.order("buy", "2026-03-03", 10, "30.00", "")
	petr4["brokerage_id"], petr4["instrument"] = f.brl, "PETR4"
	petr4["quantity"] = units(10, "PETR4")
	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, "/api/v1/trades", petr4),
		http.StatusUnprocessableEntity,
		"currency_unsupported",
		"cash_account_id",
	)
}

// FC2: a rate is refused with cash in the base currency.
func TestS771RateWithBaseCash(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)

	body := f.order("buy", "2026-03-03", 10, "30.00", "5.20")
	body["brokerage_id"], body["instrument"], body["cash_account_id"] = f.brl, "PETR4", f.brlCash
	body["quantity"], body["fees"] = units(10, "PETR4"), apitest.BRL(100)
	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, "/api/v1/trades", body),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"exchange_rate",
	)
}

// FC2: a stored price of the base in the cash currency gives the inverse rate at 12 decimals.
func TestS768ReversedRate(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)

	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument": "BRL", "quote_instrument": "USD", "date": "2026-03-03", "value": "0.25",
	}, http.StatusCreated, nil)

	if r := f.buy("2026-03-03", ""); r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	f.expectRows(t, tradeRowSQL, "buy 2000000 400 0 0 0 0 BRL 4.000000000000")
}

// S776 (FC11): a correction takes the rate again.
func TestS776CorrectionTakesTheRate(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)

	var buy idOnly
	f.buy("2026-03-03", "5.20").Decode(t, &buy)

	r := f.h.Do(http.MethodPut, "/api/v1/trades/"+buy.ID, map[string]any{
		"expected_version": 1,
		"reason":           "rate of the statement",
		"trade":            f.order("buy", "2026-03-03", 10, "500.00", "5.30"),
	})
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	f.expectRows(t, tradeRowSQL, "buy 2650000 530 0 0 0 0 BRL 5.300000000000")
	f.expectRows(t, f.postingSQL("p.account_id = t.account_id"), "10 2650530")
}

func newForeignCashFixture(t *testing.T) foreignCashFixture {
	t.Helper()

	h := apitest.New(t, apitest.As(apitest.Brazil()))
	for _, in := range []map[string]any{
		{
			"code": "VOO", "type": "etf", "scale": 0, "name": "VOO",
			"quote_currency": "USD", "exchange": "ARCX",
		},
		security("PETR4", "stock"),
	} {
		h.MustDo(http.MethodPost, "/api/v1/instruments", in, http.StatusCreated, nil)
	}

	var inst idOnly
	h.MustDo(http.MethodPost, "/api/v1/institutions",
		map[string]string{"name": "IBKR"}, http.StatusCreated, &inst)

	f := foreignCashFixture{h: h}
	f.brokerage = h.Account("IBKR", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID, "currency": "USD",
	})
	f.cash = h.Account("IBKR cash USD", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID, "parent_id": f.brokerage, "currency": "USD",
	})
	f.eur = h.Account("IBKR EUR", "asset", "checking", map[string]any{
		"institution_id": inst.ID, "currency": "EUR",
	})
	f.brl = h.Account("IBKR Brasil", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
	})
	f.brlCash = h.Account("IBKR Brasil cash", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID, "parent_id": f.brl,
	})
	f.dividend = h.Account("Dividends", "income", "", nil)

	checking := h.Account("Checking", "asset", "checking", nil)
	h.Record(
		"2026-01-01",
		h.Posting(checking, 10000000),
		h.Posting(f.system(t, "opening_balances"), -10000000),
	)
	h.MustDo(http.MethodPost, "/api/v1/exchanges", map[string]any{
		"from_account_id": checking, "to_account_id": f.cash, "date": "2026-01-02",
		"from_amount": apitest.BRL(5200000), "to_amount": usd(1000000),
	}, http.StatusCreated, nil)

	return f
}

func (f foreignCashFixture) system(t *testing.T, role string) string {
	t.Helper()

	return systemAccount(t, f.h, role)
}

func (f foreignCashFixture) buy(date, rate string) apitest.Response {
	return f.h.Do(http.MethodPost, "/api/v1/trades", f.order("buy", date, 10, "500.00", rate))
}

func (f foreignCashFixture) order(
	side, date string,
	quantity int64,
	price, rate string,
) map[string]any {
	body := map[string]any{
		"brokerage_id": f.brokerage, "instrument": "VOO", "cash_account_id": f.cash,
		"side": side, "date": date, "unit_price": price, "fees": usd(100),
		"quantity": units(quantity, "VOO"),
	}
	if rate != "" {
		body["exchange_rate"] = rate
	}

	return body
}

// postingSQL selects the amount and weight of the postings of the trades on the accounts that
// where names, in the order of the trades.
func (f foreignCashFixture) postingSQL(where string) string {
	return `SELECT p.amount, p.weight FROM ledger_posting p
		JOIN ledger_trade t ON t.transaction_id = p.transaction_id WHERE ` + where +
		" ORDER BY t.side"
}

func (f foreignCashFixture) cashPostings() string {
	return f.postingSQL("p.account_id = '" + f.cash + "'")
}

func (f foreignCashFixture) expectRows(t *testing.T, sql string, want ...string) {
	t.Helper()

	if got := f.h.Rows(sql); !slices.Equal(got, want) {
		t.Fatalf("rows = %q, want %q", got, want)
	}
}

func (f foreignCashFixture) expectSum(t *testing.T, account, want string) {
	t.Helper()

	got := f.h.Rows(
		`SELECT coalesce(sum(amount), 0)::text FROM ledger_posting WHERE account_id::text = $1`,
		account,
	)
	if !slices.Equal(got, []string{want}) {
		t.Fatalf("sum of %s = %q, want %s", account, got, want)
	}
}

func usd(amount int64) map[string]any {
	return map[string]any{"amount": amount, "currency": "USD"}
}
