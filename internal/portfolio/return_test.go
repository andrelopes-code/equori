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

	query := fmt.Sprintf("from=%s&to=%s&value_in=BRL", from, to)
	if account != "" {
		query = "account_id=" + account + "&" + query
	}

	r := f.h.Do(http.MethodGet, "/api/v1/reports/return?"+query, nil)

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

	if got.AnnualBP != 500 || got.Opening["amount"] != float64(100000) ||
		got.Closing["amount"] != float64(105000) ||
		len(got.Flows) != 0 {
		t.Fatalf("return = %+v", got)
	}

	// A contribution of 1,000.00 on 2026-04-30 and a closing value of 2,050.00 is 3.33%
	// (solved independently with 50-digit decimals, days over 365).
	f.h.Record("2026-04-30", apitest.Posting(checking, -100000), apitest.Posting(f.cash, 100000))

	_, got = f.returnOf(t, f.xp, "2025-11-01", "2026-10-31")
	if got.AnnualBP != 333 || got.Closing["amount"] != float64(205000) || len(got.Flows) != 1 ||
		got.Flows[0].Date != "2026-04-30" ||
		got.Flows[0].Amount["amount"] != float64(100000) {
		t.Fatalf("return with a contribution = %+v", got)
	}
}

// The return without account_id covers every brokerage tree of the book as one tree.
func TestReturnOfTheWholePortfolio(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	checking := f.h.Account("Checking", "asset", "checking", nil)
	other := f.h.Account("Other broker", "asset", "brokerage", nil)
	otherCash := f.h.Account(
		"Other cash",
		"asset",
		"brokerage",
		map[string]any{"parent_id": other, "currency": "BRL"},
	)
	f.h.Record("2025-10-15", apitest.Posting(checking, -100000), apitest.Posting(f.cash, 100000))
	f.h.Record("2025-10-15", apitest.Posting(checking, -100000), apitest.Posting(otherCash, 100000))
	f.income(t, f.mxrf11, "dividend", 5000, f.dividends)
	// A transfer between the two brokerages is internal to the portfolio.
	f.h.Record("2026-03-01", apitest.Posting(f.cash, -20000), apitest.Posting(otherCash, 20000))

	// Opening 1,000.00 + 1,000.00, a dividend of 50.00, closing 2,050.00 and no flow:
	// 2050 / 2000 = 1.025 in 365 days is 250 basis points.
	r, got := f.returnOf(t, "", "2025-11-01", "2026-10-31")
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	if got.AnnualBP != 250 || got.Opening["amount"] != float64(200000) ||
		got.Closing["amount"] != float64(205000) ||
		len(got.Flows) != 0 {
		t.Fatalf("portfolio return = %+v", got)
	}

	// Another book has no brokerage: no money was invested.
	stranger := f.h.Login("stranger@example.com")
	f.h.ExpectProblem(
		f.h.Call(
			stranger,
			http.MethodGet,
			"/api/v1/reports/return?from=2025-11-01&to=2026-10-31",
			nil,
		),
		http.StatusUnprocessableEntity,
		"return_undefined",
		"",
	)
}

// S127: a period in which no money was invested has no return (amendment A123).
func TestS127ReturnUndefined(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	r, _ := f.returnOf(t, f.xp, "2025-11-01", "2026-10-31")
	f.h.ExpectProblem(r, http.StatusUnprocessableEntity, "return_undefined", "")
}

// Return honesty HR2: a period of two years is measured.
func TestReturnOverYears(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	checking := f.h.Account("Checking", "asset", "checking", nil)
	f.h.Record("2025-10-15", apitest.Posting(checking, -100000), apitest.Posting(f.cash, 100000))
	f.income(t, f.mxrf11, "dividend", 5000, f.dividends)

	r, got := f.returnOf(t, f.xp, "2024-11-01", "2026-10-31")
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	if got.Opening["amount"] != float64(0) || got.Closing["amount"] != float64(105000) ||
		len(got.Flows) != 1 || got.Flows[0].Date != "2025-10-15" {
		t.Fatalf("return over two years = %+v", got)
	}
}

// Return honesty HR10: an opening balance dated in the period is money that entered the tree, a
// flow, not a gain.
func TestReturnCountsAnOpeningBalanceAsAFlow(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	var opening string

	err := f.h.Pool.QueryRow(
		t.Context(),
		`SELECT id::text FROM ledger_account WHERE system_role = 'opening_balances'`,
	).Scan(&opening)
	if err != nil {
		t.Fatal(err)
	}

	f.h.Record("2026-03-01", apitest.Posting(opening, -100000), apitest.Posting(f.cash, 100000))

	r, got := f.returnOf(t, f.xp, "2025-11-01", "2026-10-31")
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	if got.AnnualBP != 0 || got.Closing["amount"] != float64(100000) || len(got.Flows) != 1 ||
		got.Flows[0].Date != "2026-03-01" ||
		got.Flows[0].Amount["amount"] != float64(100000) {
		t.Fatalf("return = %+v", got)
	}
}

// HR2: the longest period is 3,660 days.
func TestReturnRequestErrors(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	r, _ := f.returnOf(t, f.xp, "2015-10-31", "2026-10-31")
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
	f.h.ExpectProblem(
		f.h.Do(http.MethodGet, url, nil),
		http.StatusUnprocessableEntity,
		"price_missing",
		"",
	)

	// A constant rate keeps the return of the same flows: 1,000.00 BRL to 1,050.00 BRL is 5% in USD too.
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/prices",
		map[string]any{
			"instrument":       "USD",
			"quote_instrument": "BRL",
			"date":             "2025-10-31",
			"value":            "5",
		},
		http.StatusCreated,
		nil,
	)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/prices",
		map[string]any{
			"instrument":       "USD",
			"quote_instrument": "BRL",
			"date":             "2026-10-31",
			"value":            "5",
		},
		http.StatusCreated,
		nil,
	)
	var got returnOut
	f.h.MustDo(http.MethodGet, url, nil, http.StatusOK, &got)

	if got.AnnualBP != 500 || got.Opening["currency"] != "USD" ||
		got.Opening["amount"] != float64(20000) ||
		got.Closing["amount"] != float64(21000) {
		t.Fatalf("return in USD = %+v", got)
	}
}

// RE1 to RE3 (docs/specs/2026-11-27-return-edge-cases-design.md): a period whose annual rate has
// no solution keeps its time-weighted return, and an income on an emptied tree has no base.
func TestReturnEdgeCases(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		record   func(f fixture, checking string)
		from, to string
		annual   *int
		period   int
	}{
		{
			name: "RE1 a deposit measured on its own day",
			record: func(f fixture, checking string) {
				f.h.Record(
					"2026-10-26",
					apitest.Posting(checking, -100000),
					apitest.Posting(f.cash, 100000),
				)
			},
			from:   "2026-10-26",
			to:     "2026-10-26",
			period: 0,
		},
		{
			// A dividend of 50.00 one day after a deposit of 1,000.00: 5% in a day is above
			// 100,000% a year.
			name: "RE2 an annual rate beyond the solver",
			record: func(f fixture, checking string) {
				f.h.Record(
					"2026-10-25",
					apitest.Posting(checking, -100000),
					apitest.Posting(f.cash, 100000),
				)
				f.income(t, f.mxrf11, "dividend", 5000, f.dividends)
			},
			from:   "2026-10-25",
			to:     "2026-10-26",
			period: 500,
		},
		{
			// 1,000.00 in, 1,000.00 out on 2026-10-01, a dividend of 50.00 on 2026-10-26.
			name: "RE3 an income after the tree was emptied",
			record: func(f fixture, checking string) {
				f.h.Record(
					"2025-10-15",
					apitest.Posting(checking, -100000),
					apitest.Posting(f.cash, 100000),
				)
				f.h.Record(
					"2026-10-01",
					apitest.Posting(f.cash, -100000),
					apitest.Posting(checking, 100000),
				)
				f.income(t, f.mxrf11, "dividend", 5000, f.dividends)
			},
			from:   "2025-11-01",
			to:     "2026-10-31",
			annual: new(544),
			period: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t)
			tt.record(f, f.h.Account("Checking", "asset", "checking", nil))
			f.h.Dispatch()

			url := fmt.Sprintf(
				"/api/v1/reports/return?account_id=%s&from=%s&to=%s&value_in=BRL",
				f.xp,
				tt.from,
				tt.to,
			)
			r := f.h.Do(http.MethodGet, url, nil)
			if r.Status != http.StatusOK {
				t.Fatalf("status %d: %s", r.Status, r.Body)
			}

			var got struct {
				AnnualBP *int `json:"annual_bp"`
				PeriodBP *int `json:"period_bp"`
			}
			r.Decode(t, &got)

			if got.PeriodBP == nil || *got.PeriodBP != tt.period {
				t.Fatalf("period_bp = %v, want %d", got.PeriodBP, tt.period)
			}

			if (got.AnnualBP == nil) != (tt.annual == nil) ||
				(got.AnnualBP != nil && *got.AnnualBP != *tt.annual) {
				t.Fatalf("annual_bp = %v, want %v", got.AnnualBP, tt.annual)
			}
		})
	}
}
