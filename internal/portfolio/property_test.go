package portfolio_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type propertyWorthOut struct {
	Assets      map[string]any `json:"assets"`
	Liabilities map[string]any `json:"liabilities"`
	Net         map[string]any `json:"net"`
}

// S663 (A259, PA6): a home of 400,000.00 bought with 100,000.00 of cash and 300,000.00 of
// financing leaves the net worth unchanged and groups under the type property.
func TestS663PropertyNetWorthAndAllocation(t *testing.T) {
	t.Parallel()
	f, _ := propertyFixture(t)

	worth := f.netWorth(t)
	allocation := f.allocation(t, "type")

	// Assets: checking 50,000.00 and the home 400,000.00; liabilities: the loan, 300,000.00.
	if worth.Assets["amount"] != float64(45000000) ||
		worth.Liabilities["amount"] != float64(30000000) ||
		worth.Net["amount"] != float64(15000000) {
		t.Fatalf("net worth = %+v", worth)
	}

	if len(allocation.Groups) != 2 ||
		allocation.Groups[0].Key != "property" ||
		allocation.Groups[0].Value["amount"] != float64(40000000) ||
		allocation.Groups[0].ShareBP != 8888 ||
		allocation.Groups[1].Key != "currency" ||
		allocation.Groups[1].Value["amount"] != float64(5000000) ||
		allocation.Groups[1].ShareBP != 1112 {
		t.Fatalf("by type = %+v", allocation)
	}
}

// S664 (A259, PA3): a new value of the home is an assertion resolved as an adjustment; the net
// worth rises by the difference.
func TestS664PropertyRevaluation(t *testing.T) {
	t.Parallel()
	f, home := propertyFixture(t)
	var assertion struct {
		Assertion struct {
			ID string `json:"id"`
		} `json:"assertion"`
		Difference map[string]any `json:"difference"`
	}
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/accounts/"+home+"/balance-assertions",
		map[string]any{
			"date":   "2026-10-31",
			"amount": map[string]any{"amount": 42000000, "currency": "BRL"},
		},
		http.StatusCreated,
		&assertion,
	)

	var resolved struct {
		Resolution string `json:"resolution"`
	}
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/balance-assertions/"+assertion.Assertion.ID+"/resolve",
		map[string]any{"resolution": "adjustment"},
		http.StatusOK,
		&resolved,
	)
	f.h.Dispatch()

	worth := f.netWorth(t)

	if assertion.Difference["amount"] != float64(2000000) || resolved.Resolution != "adjustment" {
		t.Fatalf("assertion = %+v, resolution = %q", assertion, resolved.Resolution)
	}

	if worth.Net["amount"] != float64(17000000) {
		t.Fatalf("net worth = %+v", worth)
	}
}

// propertyFixture holds checking 50,000.00, a home of 400,000.00 and a loan of 300,000.00.
func propertyFixture(t *testing.T) (fixture, string) {
	t.Helper()
	f := newFixture(t)
	checking := f.h.Account("Nubank", "asset", "checking", nil)
	home := f.h.Account("Apartment", "asset", "property", nil)
	loan := f.h.Account("Financing", "liability", "loan", nil)
	f.h.Record(
		"2026-10-01",
		apitest.Posting(checking, 15000000),
		apitest.Posting(f.dividends, -15000000),
	)
	f.h.Record(
		"2026-10-02",
		apitest.Posting(home, 40000000),
		apitest.Posting(checking, -10000000),
		apitest.Posting(loan, -30000000),
	)
	f.h.Dispatch()

	return f, home
}

func (f fixture) netWorth(t *testing.T) propertyWorthOut {
	t.Helper()
	var out propertyWorthOut
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/reports/net-worth?date=2026-11-01",
		nil,
		http.StatusOK,
		&out,
	)

	return out
}
