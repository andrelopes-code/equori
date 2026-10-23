package portfolio_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type returnOut struct {
	AnnualBP int `json:"annual_bp"`
	Flows    []struct {
		Date   string         `json:"date"`
		Amount map[string]any `json:"amount"`
	} `json:"flows"`
	Opening map[string]any `json:"opening"`
	Closing map[string]any `json:"closing"`
}

func (f fixture) returnOf(t *testing.T, account, from, to string) (apitest.Response, returnOut) {
	t.Helper()
	f.h.Dispatch()
	r := f.h.Do(http.MethodGet, fmt.Sprintf("/api/v1/reports/return?account_id=%s&from=%s&to=%s&value_in=BRL", account, from, to), nil)
	var out returnOut
	if r.Status == http.StatusOK {
		r.Decode(t, &out)
	}
	return r, out
}

// S126: the return of a brokerage over a year, with and without a contribution (amendment A123).
func TestS126ReturnOfBrokerage(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	checking := f.h.Account("Checking", "asset", "checking", nil)
	f.h.Record("2025-10-15", apitest.Posting(checking, -100000), apitest.Posting(f.cash, 100000))
	f.income(t, f.mxrf11, "dividend", 5000, f.dividends)

	// 1,000.00 at the day before the period, a dividend of 50.00, 1,050.00 at the end: 5% in 365 days.
	r, got := f.returnOf(t, f.xp, "2025-11-01", "2026-10-31")
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
	if got.AnnualBP != 500 || got.Opening["amount"] != float64(100000) || got.Closing["amount"] != float64(105000) || len(got.Flows) != 0 {
		t.Fatalf("return = %+v", got)
	}

	// A contribution of 1,000.00 on 2026-04-30 and a closing value of 2,050.00 is 3.33%
	// (solved independently with 50-digit decimals, days over 365).
	f.h.Record("2026-04-30", apitest.Posting(checking, -100000), apitest.Posting(f.cash, 100000))
	_, got = f.returnOf(t, f.xp, "2025-11-01", "2026-10-31")
	if got.AnnualBP != 333 || got.Closing["amount"] != float64(205000) || len(got.Flows) != 1 || got.Flows[0].Date != "2026-04-30" || got.Flows[0].Amount["amount"] != float64(100000) {
		t.Fatalf("return with a contribution = %+v", got)
	}
}

// S127: a period in which no money was invested has no return (amendment A123).
func TestS127ReturnUndefined(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	r, _ := f.returnOf(t, f.xp, "2025-11-01", "2026-10-31")
	f.h.ExpectProblem(r, http.StatusUnprocessableEntity, "return_undefined", "")
}

func TestReturnRequestErrors(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	r, _ := f.returnOf(t, f.xp, "2025-10-01", "2026-10-31")
	f.h.ExpectProblem(r, http.StatusBadRequest, "invalid_request", "to")
	r, _ = f.returnOf(t, f.xp, "2026-10-31", "2026-10-01")
	f.h.ExpectProblem(r, http.StatusBadRequest, "invalid_request", "to")
	r, _ = f.returnOf(t, "00000000-0000-4000-8000-000000000000", "2026-01-01", "2026-10-01")
	f.h.ExpectProblem(r, http.StatusNotFound, "not_found", "")
}

func TestReturnValuedInAnotherCurrency(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	checking := f.h.Account("Checking", "asset", "checking", nil)
	f.h.Record("2025-10-15", apitest.Posting(checking, -100000), apitest.Posting(f.cash, 100000))
	f.income(t, f.mxrf11, "dividend", 5000, f.dividends)
	f.h.Dispatch()
	url := "/api/v1/reports/return?account_id=" + f.xp + "&from=2025-11-01&to=2026-10-31&value_in=USD"
	f.h.ExpectProblem(f.h.Do(http.MethodGet, url, nil), http.StatusUnprocessableEntity, "price_missing", "")

	// A constant rate keeps the return of the same flows: 1,000.00 BRL to 1,050.00 BRL is 5% in USD too.
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "USD", "quote_instrument": "BRL", "date": "2025-10-31", "value": "5"}, http.StatusCreated, nil)
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "USD", "quote_instrument": "BRL", "date": "2026-10-31", "value": "5"}, http.StatusCreated, nil)
	var got returnOut
	f.h.MustDo(http.MethodGet, url, nil, http.StatusOK, &got)
	if got.AnnualBP != 500 || got.Opening["currency"] != "USD" || got.Opening["amount"] != float64(20000) || got.Closing["amount"] != float64(21000) {
		t.Fatalf("return in USD = %+v", got)
	}
}
