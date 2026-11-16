package portfolio_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// fixture holds the brokerage of fixture 6.1: XP with XP cash, XP MXRF11 and XP PETR4.
type fixture struct {
	h              *apitest.Harness
	xp, cash       string
	mxrf11, petr4  string
	dividends, jcp string
	institution    string
}

func security(code, typ string) map[string]any {
	return map[string]any{
		"code":           code,
		"type":           typ,
		"scale":          0,
		"name":           code,
		"quote_currency": "BRL",
		"exchange":       "BVMF",
	}
}

func newFixture(t *testing.T, opts ...apitest.Option) fixture {
	h := apitest.New(t, append([]apitest.Option{apitest.Today("2026-11-01")}, opts...)...)
	h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("MXRF11", "reit"),
		http.StatusCreated,
		nil,
	)
	h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("PETR4", "stock"),
		http.StatusCreated,
		nil,
	)
	var inst struct {
		ID string `json:"id"`
	}
	h.MustDo(
		http.MethodPost,
		"/api/v1/institutions",
		map[string]string{"name": "XP"},
		http.StatusCreated,
		&inst,
	)
	f := fixture{h: h, institution: inst.ID}
	f.xp = h.Account(
		"XP",
		"asset",
		"brokerage",
		map[string]any{"institution_id": inst.ID, "currency": "BRL"},
	)
	child := func(name, currency string) string {
		return h.Account(
			name,
			"asset",
			"brokerage",
			map[string]any{"institution_id": inst.ID, "parent_id": f.xp, "currency": currency},
		)
	}
	f.cash = child("XP cash", "BRL")
	f.mxrf11 = child("XP MXRF11", "MXRF11")
	f.petr4 = child("XP PETR4", "PETR4")
	f.dividends = h.Account("Dividends", "income", "", nil)
	f.jcp = h.Account("JCP", "income", "", nil)

	return f
}

func units(
	n int64,
	code string,
) map[string]any {
	return map[string]any{"amount": n, "currency": code}
}

func (f fixture) trade(
	t *testing.T,
	side, date string,
	quantity int64,
	price string,
	fees int64,
) string {
	t.Helper()

	body := map[string]any{
		"account_id":      f.mxrf11,
		"cash_account_id": f.cash,
		"side":            side,
		"date":            date,
		"quantity":        units(quantity, "MXRF11"),
		"unit_price":      price,
	}
	if fees != 0 {
		body["fees"] = apitest.BRL(fees)
	}

	var out struct {
		ID string `json:"id"`
	}
	f.h.MustDo(http.MethodPost, "/api/v1/trades", body, http.StatusCreated, &out)

	return out.ID
}

func (f fixture) petr4Trade(
	t *testing.T,
	side, date string,
	quantity int64,
	price string,
) string {
	t.Helper()

	var out struct {
		ID string `json:"id"`
	}
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id":      f.petr4,
		"cash_account_id": f.cash,
		"side":            side,
		"date":            date,
		"quantity":        units(quantity, "PETR4"),
		"unit_price":      price,
	}, http.StatusCreated, &out)

	return out.ID
}

type positionOut struct {
	AccountID   string         `json:"account_id"`
	Instrument  string         `json:"instrument"`
	Quantity    map[string]any `json:"quantity"`
	CostBasis   map[string]any `json:"cost_basis"`
	AverageCost string         `json:"average_cost"`
	MarketValue map[string]any `json:"market_value"`
	Prices      []struct {
		Value  string `json:"value"`
		Date   string `json:"date"`
		Source string `json:"source"`
	} `json:"prices"`
}

func (f fixture) positions(t *testing.T, date string) []positionOut {
	t.Helper()
	f.h.Dispatch()
	var out struct {
		Items []positionOut `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/positions?date="+date, nil, http.StatusOK, &out)

	return out.Items
}

type resultOut struct {
	TransactionID string         `json:"transaction_id"`
	Instrument    string         `json:"instrument"`
	Month         string         `json:"month"`
	Quantity      map[string]any `json:"quantity"`
	Cost          map[string]any `json:"cost"`
	Proceeds      map[string]any `json:"proceeds"`
	Result        map[string]any `json:"result"`
	TaxClass      string         `json:"tax_class"`
	Kind          string         `json:"kind"`
}

func (f fixture) results(t *testing.T, year string) []resultOut {
	t.Helper()
	f.h.Dispatch()
	var out struct {
		Items []resultOut `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/realized-results?year="+year, nil, http.StatusOK, &out)

	return out.Items
}

func TestS64PositionAndRealizedResult(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	buy := f.trade(t, "buy", "2026-10-05", 150, "10.05", 490)
	sale := f.trade(t, "sell", "2026-10-20", 50, "10.80", 210)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/prices",
		map[string]any{
			"instrument":       "MXRF11",
			"quote_instrument": "BRL",
			"date":             "2026-10-29",
			"value":            "9.36",
		},
		http.StatusCreated,
		nil,
	)

	ps := f.positions(t, "2026-11-01")
	if len(ps) != 1 {
		t.Fatalf("positions = %+v", ps)
	}

	p := ps[0]
	if p.AccountID != f.mxrf11 || p.Instrument != "MXRF11" ||
		p.Quantity["amount"] != float64(100) ||
		p.CostBasis["amount"] != float64(100827) ||
		p.AverageCost != "10.0827" ||
		p.MarketValue["amount"] != float64(93600) ||
		len(p.Prices) != 1 ||
		p.Prices[0].Value != "9.36" {
		t.Fatalf("position = %+v", p)
	}

	// Review Focus 1: refused changes before the sale leave its realized result as it was.
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id":      f.mxrf11,
		"cash_account_id": f.cash,
		"side":            "buy",
		"date":            "2026-10-15",
		"quantity":        units(10, "MXRF11"),
		"unit_price":      "10",
	}), http.StatusConflict, "later_sale_exists", "")
	f.h.ExpectProblem(
		f.h.Do(
			http.MethodPost,
			"/api/v1/transactions/"+buy+"/void",
			map[string]string{"reason": "typo"},
		),
		http.StatusConflict,
		"later_sale_exists",
		"",
	)

	rs := f.results(t, "2026")
	if len(rs) != 1 || rs[0].TransactionID != sale || rs[0].Month != "2026-10" ||
		rs[0].Result["amount"] != float64(3377) ||
		rs[0].Cost["amount"] != float64(50413) ||
		rs[0].Proceeds["amount"] != float64(53790) ||
		rs[0].Quantity["amount"] != float64(50) ||
		rs[0].TaxClass != "fii" {
		t.Fatalf("results = %+v", rs)
	}
}

// A228 IO15, S424: 30 units close the day's purchase, 20 come from the stock.
func TestS424RealizedResultsSplitByKind(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.petr4Trade(t, "buy", "2026-11-03", 100, "10.00")
	f.petr4Trade(t, "buy", "2026-11-10", 30, "12.00")
	sale := f.petr4Trade(t, "sell", "2026-11-10", 50, "13.00")

	rs := f.results(t, "2026")
	if len(rs) != 2 {
		t.Fatalf("results = %+v", rs)
	}

	want := []struct {
		kind                             string
		quantity, cost, proceeds, result float64
	}{
		{"day_trade", 30, 36000, 39000, 3000},
		{"swing", 20, 20000, 26000, 6000},
	}
	for i, w := range want {
		r := rs[i]
		if r.TransactionID != sale || r.Kind != w.kind ||
			r.Quantity["amount"] != w.quantity || r.Cost["amount"] != w.cost ||
			r.Proceeds["amount"] != w.proceeds || r.Result["amount"] != w.result {
			t.Fatalf("result %d = %+v, want %+v", i, r, w)
		}
	}
}

func TestS65IncomeEvents(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	income := func(account, typ string, gross int64, category string) {
		f.h.MustDo(http.MethodPost, "/api/v1/investment-income", map[string]any{
			"account_id":      account,
			"cash_account_id": f.cash,
			"income_type":     typ,
			"date":            "2026-10-26",
			"gross":           apitest.BRL(gross),
			"category_id":     category,
		}, http.StatusCreated, nil)
	}
	income(f.mxrf11, "dividend", 1000, f.dividends)
	income(f.petr4, "jcp", 4500, f.jcp)
	f.h.Dispatch()

	var out struct {
		Items []struct {
			Instrument   string         `json:"instrument"`
			IncomeType   string         `json:"income_type"`
			TaxTreatment string         `json:"tax_treatment"`
			Gross        map[string]any `json:"gross"`
			Withheld     map[string]any `json:"withheld"`
			Date         string         `json:"date"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/income-events?year=2026", nil, http.StatusOK, &out)

	if len(out.Items) != 2 {
		t.Fatalf("events = %+v", out.Items)
	}

	d, j := out.Items[0], out.Items[1]
	if d.Instrument != "MXRF11" || d.IncomeType != "dividend" || d.TaxTreatment != "exempt" ||
		d.Gross["amount"] != float64(1000) ||
		d.Withheld["amount"] != float64(0) ||
		d.Date != "2026-10-26" {
		t.Fatalf("dividend = %+v", d)
	}

	if j.Instrument != "PETR4" || j.IncomeType != "jcp" || j.TaxTreatment != "exclusive" ||
		j.Gross["amount"] != float64(4500) ||
		j.Withheld["amount"] != float64(788) {
		t.Fatalf("JCP = %+v", j)
	}
}
