package reporting_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S778 (foreign cash FC22): a trade paid in dollars leaves the archive and comes back with its
// rate and its amounts.
func TestS778ArchiveKeepsTheRate(t *testing.T) {
	t.Parallel()
	source := apitest.New(t, apitest.As(apitest.Brazil()), apitest.Today("2026-10-26"))
	source.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code":           "VOO",
		"type":           "etf",
		"scale":          0,
		"name":           "VOO",
		"quote_currency": "USD",
		"exchange":       "ARCX",
	}, http.StatusCreated, nil)

	var inst struct {
		ID string `json:"id"`
	}
	source.MustDo(http.MethodPost, "/api/v1/institutions",
		map[string]string{"name": "IBKR"}, http.StatusCreated, &inst)

	brokerage := source.Account("IBKR", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"currency":       "USD",
	})
	cash := source.Account("IBKR cash USD", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"parent_id":      brokerage,
		"currency":       "USD",
	})
	checking := source.Account("Checking", "asset", "checking", nil)
	source.MustDo(http.MethodPost, "/api/v1/exchanges", map[string]any{
		"from_account_id": checking,
		"to_account_id":   cash,
		"date":            "2026-01-02",
		"from_amount":     apitest.BRL(5200000),
		"to_amount":       map[string]any{"amount": 1000000, "currency": "USD"},
	}, http.StatusCreated, nil)
	source.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"brokerage_id":    brokerage,
		"instrument":      "VOO",
		"cash_account_id": cash,
		"side":            "buy",
		"date":            "2026-03-03",
		"unit_price":      "500.00",
		"exchange_rate":   "5.20",
		"fees":            map[string]any{"amount": 100, "currency": "USD"},
		"quantity":        map[string]any{"amount": 10, "currency": "VOO"},
	}, http.StatusCreated, nil)

	target := apitest.New(t, apitest.As(apitest.Brazil()), apitest.Today("2026-10-26"))

	if r := target.Upload(importPath, "a.zip", export(t, source)); r.Status != http.StatusOK {
		t.Fatalf("import = %d: %s", r.Status, r.Body)
	}

	trade := target.Rows(
		`SELECT side || ' ' || gross || ' ' || fees || ' ' || exchange_rate::text FROM ledger_trade`,
	)
	if want := []string{"buy 2600000 520 5.200000000000"}; !slices.Equal(trade, want) {
		t.Errorf("trade = %q, want %q", trade, want)
	}

	postings := target.Rows(
		`SELECT a.name || ' ' || p.amount || ' ' || p.weight FROM ledger_posting p
		JOIN ledger_trade t ON t.transaction_id = p.transaction_id
		JOIN ledger_account a ON a.id = p.account_id ORDER BY a.name`,
	)
	if want := []string{"IBKR cash USD -500100 -2600520", "VOO 10 2600520"}; !slices.Equal(
		postings,
		want,
	) {
		t.Errorf("postings = %q, want %q", postings, want)
	}
}
