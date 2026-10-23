package portfolio_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type groupOut struct {
	Key     string         `json:"key"`
	Value   map[string]any `json:"value"`
	ShareBP int            `json:"share_bp"`
}

type allocationOut struct {
	Total  map[string]any `json:"total"`
	Groups []groupOut     `json:"groups"`
}

// allocationFixture holds checking 500.00, XP cash 400.00 and 10 MXRF11 worth 105.00 at 10.50.
func allocationFixture(t *testing.T) (fixture, string) {
	t.Helper()
	f := newFixture(t)
	checking := f.h.Account("Nubank", "asset", "checking", nil)
	f.h.Record("2026-10-01", apitest.Posting(checking, 100000), apitest.Posting(f.dividends, -100000))
	f.h.Record("2026-10-02", apitest.Posting(checking, -50000), apitest.Posting(f.cash, 50000))
	f.trade(t, "buy", "2026-10-10", 10, "10.00", 0)
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "MXRF11", "quote_instrument": "BRL", "date": "2026-10-30", "value": "10.5"}, http.StatusCreated, nil)
	f.h.Dispatch()
	return f, checking
}

func (f fixture) allocation(t *testing.T, by string) allocationOut {
	t.Helper()
	var out allocationOut
	f.h.MustDo(http.MethodGet, "/api/v1/reports/allocation?date=2026-11-01&by="+by, nil, http.StatusOK, &out)
	return out
}

// S128: allocation by instrument type, currency and institution (amendment A125).
func TestS128Allocation(t *testing.T) {
	t.Parallel()
	f, _ := allocationFixture(t)

	// Checking 500.00 and XP cash 400.00 are currency; 10 shares at 10.50 are 105.00 of reit.
	byType := f.allocation(t, "type")
	if byType.Total["amount"] != float64(100500) || byType.Total["currency"] != "BRL" || len(byType.Groups) != 2 ||
		byType.Groups[0].Key != "currency" || byType.Groups[0].Value["amount"] != float64(90000) || byType.Groups[0].ShareBP != 8955 ||
		byType.Groups[1].Key != "reit" || byType.Groups[1].Value["amount"] != float64(10500) || byType.Groups[1].ShareBP != 1045 {
		t.Fatalf("by type = %+v", byType)
	}

	byCurrency := f.allocation(t, "currency")
	if len(byCurrency.Groups) != 1 || byCurrency.Groups[0].Key != "BRL" || byCurrency.Groups[0].ShareBP != 10000 {
		t.Fatalf("by currency = %+v", byCurrency)
	}

	// XP holds 400.00 + 105.00; the checking account has no institution (key "").
	byInstitution := f.allocation(t, "institution")
	if len(byInstitution.Groups) != 2 || byInstitution.Groups[0].Key != f.institution || byInstitution.Groups[0].Value["amount"] != float64(50500) ||
		byInstitution.Groups[0].ShareBP != 5024 || byInstitution.Groups[1].Key != "" || byInstitution.Groups[1].Value["amount"] != float64(50000) ||
		byInstitution.Groups[1].ShareBP != 4976 {
		t.Fatalf("by institution = %+v", byInstitution)
	}
}

func TestAllocationErrors(t *testing.T) {
	t.Parallel()
	f, _ := allocationFixture(t)
	f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/reports/allocation?date=2026-11-01&by=region", nil), http.StatusBadRequest, "invalid_request", "by")
	f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/reports/allocation?date=2026-11-01&by=type&value_in=USD", nil), http.StatusUnprocessableEntity, "price_missing", "")

	var empty allocationOut
	f.h.MustDo(http.MethodGet, "/api/v1/reports/allocation?date=2026-09-01&by=type", nil, http.StatusOK, &empty)
	if empty.Total["amount"] != float64(0) || len(empty.Groups) != 0 {
		t.Fatalf("allocation before any posting = %+v", empty)
	}
}

// S129: net worth is the assets minus the liabilities (amendment A125).
func TestS129NetWorth(t *testing.T) {
	t.Parallel()
	f, checking := allocationFixture(t)
	loan := f.h.Account("Loan", "liability", "loan", nil)
	f.h.Record("2026-10-20", apitest.Posting(checking, 120000), apitest.Posting(loan, -120000))
	f.h.Dispatch()

	var out struct {
		Assets      map[string]any `json:"assets"`
		Liabilities map[string]any `json:"liabilities"`
		Net         map[string]any `json:"net"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/reports/net-worth?date=2026-11-01", nil, http.StatusOK, &out)
	// Assets: checking 1,700.00, XP cash 400.00, shares 105.00; liabilities: the loan, 1,200.00.
	if out.Assets["amount"] != float64(220500) || out.Liabilities["amount"] != float64(120000) || out.Net["amount"] != float64(100500) {
		t.Fatalf("net worth = %+v", out)
	}
	f.h.ExpectProblem(f.h.Do(http.MethodGet, fmt.Sprintf("/api/v1/reports/net-worth?date=2026-11-01&value_in=%s", "USD"), nil), http.StatusUnprocessableEntity, "price_missing", "")
}
