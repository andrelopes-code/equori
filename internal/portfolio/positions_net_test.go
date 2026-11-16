package portfolio_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

type netPosition struct {
	AccountID    string  `json:"account_id"`
	MarketValue  *amount `json:"market_value"`
	EstimatedTax *amount `json:"estimated_tax"`
	EstimatedNet *amount `json:"estimated_net"`
}

type netEstimate struct {
	IncomeTax amount `json:"income_tax"`
	IOF       amount `json:"iof"`
	Net       amount `json:"net"`
}

// S526: the estimate of a position is the ledger's own for the sale of its whole quantity.
func TestS526EstimatedNetOfAPosition(t *testing.T) {
	t.Parallel()
	h := newNetBook(
		t,
		apitest.Brazil(),
		"CDBN",
		"fixed_income",
		"cdb",
		"2026-01-05",
		10000,
		"1.00",
		"1.10",
	)

	p := onlyNetPosition(t, h)
	if p.MarketValue == nil || p.MarketValue.Amount != 1100000 {
		t.Fatalf("market_value = %+v, want 1100000", p.MarketValue)
	}

	var want netEstimate
	h.MustDo(
		http.MethodGet,
		fmt.Sprintf(
			"/api/v1/accounts/%s/withholding?date=2026-07-06&quantity=10000&proceeds=1100000",
			p.AccountID,
		),
		nil,
		http.StatusOK,
		&want,
	)

	tax := want.IncomeTax.Amount + want.IOF.Amount
	if p.EstimatedTax == nil || p.EstimatedTax.Amount != tax || p.EstimatedTax.Currency != "BRL" {
		t.Fatalf("estimated_tax = %+v, want %d BRL", p.EstimatedTax, tax)
	}

	if p.EstimatedNet == nil || p.EstimatedNet.Amount != want.Net.Amount {
		t.Fatalf("estimated_net = %+v, want %d", p.EstimatedNet, want.Net.Amount)
	}

	t.Logf("ledger estimate: tax %d, net %d", tax, want.Net.Amount)
}

// S527: a position without a withholding table has no estimate.
func TestS527StockHasNoEstimate(t *testing.T) {
	t.Parallel()
	h := newNetBook(t, apitest.Brazil(), "ACMEN", "stock", "", "2026-01-05", 100, "10.00", "11.00")

	p := onlyNetPosition(t, h)
	if p.MarketValue == nil || p.EstimatedTax != nil || p.EstimatedNet != nil {
		t.Fatalf("position = %+v, want a market value and no estimate", p)
	}
}

// S528: a book of a region without a table has no estimate.
func TestS528RegionWithoutTableHasNoEstimate(t *testing.T) {
	t.Parallel()

	de := apitest.Profile{
		Name:   "germany",
		Locale: locale.Locale{Language: "de", Region: "DE"},
		Base:   "EUR",
	}
	h := newNetBook(t, de, "BUNDN", "fixed_income", "bond", "2026-01-05", 10000, "1.00", "1.10")

	p := onlyNetPosition(t, h)
	if p.MarketValue == nil || p.MarketValue.Amount != 1100000 || p.EstimatedTax != nil ||
		p.EstimatedNet != nil {
		t.Fatalf("position = %+v, want a market value and no estimate", p)
	}
}

// newNetBook buys quantity units on buyDate at buyPrice and prices them on 2026-07-06.
func newNetBook(
	t *testing.T,
	profile apitest.Profile,
	code, instrumentType, subtype, buyDate string,
	quantity int64,
	buyPrice, price string,
) *apitest.Harness {
	t.Helper()

	h := apitest.New(t, apitest.Today("2026-07-06"), apitest.As(profile))
	currency := string(profile.Base)

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

	parent := h.Account("XP", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"currency":       currency,
	})
	cash := h.Account("XP cash", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"parent_id":      parent,
		"currency":       currency,
	})

	body := map[string]any{
		"code":           code,
		"type":           instrumentType,
		"scale":          0,
		"name":           code,
		"quote_currency": currency,
	}
	if subtype != "" {
		body["subtype"] = subtype
	}

	h.MustDo(http.MethodPost, "/api/v1/instruments", body, http.StatusCreated, nil)

	account := h.Account(code, "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"parent_id":      parent,
		"currency":       code,
	})
	h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id":      account,
		"cash_account_id": cash,
		"side":            "buy",
		"date":            buyDate,
		"quantity":        units(quantity, code),
		"unit_price":      buyPrice,
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument":       code,
		"quote_instrument": currency,
		"date":             "2026-07-06",
		"value":            price,
	}, http.StatusCreated, nil)

	h.Dispatch()

	return h
}

func onlyNetPosition(t *testing.T, h *apitest.Harness) netPosition {
	t.Helper()

	var out struct {
		Items []netPosition `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/positions?date=2026-07-06", nil, http.StatusOK, &out)

	if len(out.Items) != 1 {
		t.Fatalf("positions = %+v, want one", out.Items)
	}

	return out.Items[0]
}
