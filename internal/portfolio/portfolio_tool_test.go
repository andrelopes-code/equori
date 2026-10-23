package portfolio_test

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func toolOutput(t *testing.T, h *apitest.Harness, name string, args map[string]any, out any) {
	t.Helper()
	r := h.Tool(name, args)
	if r.IsError {
		t.Fatalf("%s = error %s", name, r.Content)
	}
	if err := json.Unmarshal(r.Content, out); err != nil {
		t.Fatal(err)
	}
}

type toolGroup struct {
	Key     string     `json:"key"`
	Value   tool.Money `json:"value"`
	ShareBP int        `json:"share_bp"`
}

// S128 through the tool.
func TestGetPortfolioToolAllocation(t *testing.T) {
	t.Parallel()
	f, _ := allocationFixture(t)
	var got struct {
		Total  tool.Money  `json:"total"`
		Groups []toolGroup `json:"groups"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "allocation", "by": "type", "date": "2026-11-01"}, &got)
	want := []toolGroup{
		{"currency", tool.Money{Amount: "900.00", Currency: "BRL"}, 8955},
		{"reit", tool.Money{Amount: "105.00", Currency: "BRL"}, 1045},
	}
	if got.Total != (tool.Money{Amount: "1005.00", Currency: "BRL"}) || !reflect.DeepEqual(got.Groups, want) {
		t.Errorf("allocation = %+v, want groups %+v", got, want)
	}
	// Without date the valuation date is today (2026-11-01).
	var today struct {
		Total tool.Money `json:"total"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "allocation", "by": "type"}, &today)
	if today.Total != got.Total {
		t.Errorf("total today = %+v, want %+v", today.Total, got.Total)
	}
}

// S129 through the tool.
func TestGetPortfolioToolNetWorth(t *testing.T) {
	t.Parallel()
	f, checking := allocationFixture(t)
	loan := f.h.Account("Loan", "liability", "loan", nil)
	f.h.Record("2026-10-20", apitest.Posting(checking, 120000), apitest.Posting(loan, -120000))
	f.h.Dispatch()
	type netWorth struct{ Assets, Liabilities, Net tool.Money }
	var got netWorth
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "net_worth", "date": "2026-11-01"}, &got)
	want := netWorth{tool.Money{Amount: "2205.00", Currency: "BRL"}, tool.Money{Amount: "1200.00", Currency: "BRL"}, tool.Money{Amount: "1005.00", Currency: "BRL"}}
	if got != want {
		t.Errorf("net worth = %+v, want %+v", got, want)
	}
}

func TestGetPortfolioToolPositions(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.trade(t, "buy", "2026-10-05", 150, "10.05", 490)
	f.trade(t, "sell", "2026-10-20", 50, "10.80", 210)
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "MXRF11", "quote_instrument": "BRL", "date": "2026-10-29", "value": "9.36"}, http.StatusCreated, nil)
	f.h.Dispatch()
	var got struct {
		Positions []struct {
			AccountID   string     `json:"account_id"`
			AccountName string     `json:"account_name"`
			Instrument  string     `json:"instrument"`
			Quantity    tool.Money `json:"quantity"`
			AverageCost string     `json:"average_cost"`
			CostBasis   tool.Money `json:"cost_basis"`
			MarketValue tool.Money `json:"market_value"`
		} `json:"positions"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "positions", "date": "2026-11-01"}, &got)
	if len(got.Positions) != 1 {
		t.Fatalf("positions = %+v", got.Positions)
	}
	p := got.Positions[0]
	if p.AccountID != f.mxrf11 || p.AccountName != "XP MXRF11" || p.Instrument != "MXRF11" || p.Quantity.Amount != "100" ||
		p.AverageCost != "10.0827" || p.CostBasis.Amount != "1008.27" || p.MarketValue.Amount != "936.00" {
		t.Errorf("position = %+v", p)
	}
}

func TestGetPortfolioToolLists(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	var types struct {
		IncomeTypes []string `json:"income_types"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "income_types"}, &types)
	var wantTypes struct {
		Items []string `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/investment-income-types", nil, http.StatusOK, &wantTypes)
	if len(wantTypes.Items) == 0 || !reflect.DeepEqual(types.IncomeTypes, wantTypes.Items) {
		t.Errorf("income types = %v, want %v", types.IncomeTypes, wantTypes.Items)
	}
	var sub struct {
		Subtypes []string `json:"subtypes"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "subtypes", "instrument_type": "reit"}, &sub)
	var want struct {
		Items []string `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/instrument-subtypes?type=reit", nil, http.StatusOK, &want)
	if !reflect.DeepEqual(sub.Subtypes, want.Items) {
		t.Errorf("subtypes = %v, want %v", sub.Subtypes, want.Items)
	}
}

// S126 through the tool.
func TestGetPortfolioToolReturn(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	checking := f.h.Account("Checking", "asset", "checking", nil)
	f.h.Record("2025-10-15", apitest.Posting(checking, -100000), apitest.Posting(f.cash, 100000))
	f.income(t, f.mxrf11, "dividend", 5000, f.dividends)
	f.h.Dispatch()
	var got struct {
		AnnualBP int        `json:"annual_bp"`
		Opening  tool.Money `json:"opening"`
		Closing  tool.Money `json:"closing"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "return", "account_id": f.xp, "from": "2025-11-01", "to": "2026-10-31"}, &got)
	if got.AnnualBP != 500 || got.Opening.Amount != "1000.00" || got.Closing.Amount != "1050.00" {
		t.Errorf("return = %+v", got)
	}
}

func TestGetPortfolioToolInvalidArguments(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	for _, tc := range []struct {
		args  map[string]any
		field string
	}{
		{map[string]any{"view": "return", "from": "2025-11-01", "to": "2026-10-31"}, "account_id"},
		{map[string]any{"view": "return", "account_id": "nope", "from": "2025-11-01", "to": "2026-10-31"}, "account_id"},
		{map[string]any{"view": "allocation"}, "by"},
		{map[string]any{"view": "subtypes"}, "instrument_type"},
		{map[string]any{"view": "positions", "by": "type"}, "by"},
	} {
		f.h.ExpectToolError(f.h.Tool("get_portfolio", tc.args), "invalid_arguments", tc.field)
	}
}

func TestGetPortfolioToolOtherUser(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-01"))
	other := h.LoginAs("other@example.com", locale.Locale{Language: "pt", Region: "BR"}, "BRL")
	r := h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Theirs", "class": "asset", "kind": "brokerage", "currency": "BRL"})
	var account struct {
		ID string `json:"id"`
	}
	if r.Status != http.StatusCreated || json.Unmarshal(r.Body, &account) != nil {
		t.Fatalf("create account status %d: %s", r.Status, r.Body)
	}
	h.ExpectToolError(h.Tool("get_portfolio", map[string]any{"view": "return", "account_id": account.ID, "from": "2026-01-01", "to": "2026-10-31"}), "not_found", "")
}

func TestGetPortfolioToolReturnUndefined(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.h.ExpectToolError(f.h.Tool("get_portfolio", map[string]any{"view": "return", "account_id": f.xp, "from": "2026-01-01", "to": "2026-10-31"}), "return_undefined", "")
}

// S21: a sale's realized result with its tax class.
func TestGetTaxYearTool(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.trade(t, "buy", "2026-10-05", 150, "10.05", 490)
	f.trade(t, "sell", "2026-10-20", 50, "10.80", 210)
	f.income(t, f.mxrf11, "dividend", 5000, f.dividends)
	f.h.Dispatch()
	var got struct {
		Sales []struct {
			AccountName string     `json:"account_name"`
			Instrument  string     `json:"instrument"`
			Date        string     `json:"date"`
			Quantity    tool.Money `json:"quantity"`
			Cost        tool.Money `json:"cost"`
			Proceeds    tool.Money `json:"proceeds"`
			Result      tool.Money `json:"result"`
			TaxClass    string     `json:"tax_class"`
		} `json:"sales"`
		Income []struct {
			Instrument string     `json:"instrument"`
			IncomeType string     `json:"income_type"`
			Gross      tool.Money `json:"gross"`
		} `json:"income"`
	}
	toolOutput(t, f.h, "get_tax_year", map[string]any{"year": 2026, "view": "sales"}, &got)
	if len(got.Sales) != 1 || got.Income != nil {
		t.Fatalf("sales view = %+v", got)
	}
	s := got.Sales[0]
	if s.AccountName != "XP MXRF11" || s.Instrument != "MXRF11" || s.Date != "2026-10-20" || s.Quantity.Amount != "50" || s.Cost.Amount != "504.13" ||
		s.Proceeds.Amount != "537.90" || s.Result.Amount != "33.77" || s.TaxClass != "fii" {
		t.Errorf("sale = %+v", s)
	}
	toolOutput(t, f.h, "get_tax_year", map[string]any{"year": 2026}, &got)
	if len(got.Income) != 1 || got.Income[0].Instrument != "MXRF11" || got.Income[0].IncomeType != "dividend" || got.Income[0].Gross.Amount != "50.00" {
		t.Errorf("income = %+v", got.Income)
	}
}
