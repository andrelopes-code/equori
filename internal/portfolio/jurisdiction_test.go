package portfolio_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type incomeEventOut struct {
	IncomeType   string  `json:"income_type"`
	TaxTreatment *string `json:"tax_treatment"`
}

func (f fixture) income(t *testing.T, account, typ string, gross int64, category string) {
	t.Helper()
	f.h.MustDo(http.MethodPost, "/api/v1/investment-income", map[string]any{
		"account_id":      account,
		"cash_account_id": f.cash,
		"income_type":     typ,
		"date":            "2026-10-26",
		"gross":           apitest.BRL(gross),
		"category_id":     category,
	}, http.StatusCreated, nil)
}

func (f fixture) incomeEvents(t *testing.T) []incomeEventOut {
	t.Helper()
	f.h.Dispatch()
	var out struct {
		Items []incomeEventOut `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/income-events?year=2026", nil, http.StatusOK, &out)

	return out.Items
}

func (f fixture) incomeTypes(t *testing.T) []string {
	t.Helper()
	var out struct {
		Items []string `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/investment-income-types", nil, http.StatusOK, &out)

	return out.Items
}

func (f fixture) moveToRegion(t *testing.T, region string) {
	t.Helper()

	if _, err := f.h.Pool.Exec(
		t.Context(),
		`UPDATE identity_books SET region = $1`,
		region,
	); err != nil {
		t.Fatal(err)
	}
}

func TestJurisdictionBRTreatments(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.income(t, f.mxrf11, "dividend", 1000, f.dividends)
	f.income(t, f.petr4, "jcp", 4500, f.jcp)

	es := f.incomeEvents(t)
	if len(es) != 2 || es[0].TaxTreatment == nil || *es[0].TaxTreatment != "exempt" ||
		es[1].TaxTreatment == nil ||
		*es[1].TaxTreatment != "exclusive" {
		t.Fatalf("events = %+v", es)
	}

	if got, want := f.incomeTypes(
		t,
	), []string{
		"coupon",
		"distribution",
		"dividend",
		"interest",
		"jcp",
	}; !slices.Equal(
		got,
		want,
	) {
		t.Fatalf("types = %v, want %v", got, want)
	}
}

func TestJurisdictionWithoutDefaultHasNoTreatment(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.moveToRegion(t, "DE")
	f.income(t, f.mxrf11, "dividend", 1000, f.dividends)
	f.income(t, f.petr4, "jcp", 4500, f.jcp)

	es := f.incomeEvents(t)
	if len(es) != 2 || es[0].IncomeType != "dividend" || es[0].TaxTreatment != nil ||
		es[1].IncomeType != "jcp" ||
		es[1].TaxTreatment != nil {
		t.Fatalf("events = %+v", es)
	}

	if got, want := f.incomeTypes(
		t,
	), []string{
		"coupon",
		"distribution",
		"dividend",
		"interest",
	}; !slices.Equal(
		got,
		want,
	) {
		t.Fatalf("types = %v, want %v", got, want)
	}
}

func TestIncomeTypeMustBeAnIdentifier(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	r := f.h.Do(http.MethodPost, "/api/v1/investment-income", map[string]any{
		"account_id":      f.mxrf11,
		"cash_account_id": f.cash,
		"income_type":     "Bad!",
		"date":            "2026-10-26",
		"gross":           apitest.BRL(1000),
		"category_id":     f.dividends,
	})
	f.h.ExpectProblem(r, http.StatusBadRequest, "invalid_request", "income_type")
}

func TestRebuildAllRestoresTaxData(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.income(t, f.mxrf11, "dividend", 1000, f.dividends)
	f.incomeEvents(t)

	if _, err := f.h.Pool.Exec(
		t.Context(),
		`UPDATE portfolio_income_event SET tax_treatment = NULL`,
	); err != nil {
		t.Fatal(err)
	}

	if err := f.h.App.Portfolio.RebuildAll(t.Context()); err != nil {
		t.Fatal(err)
	}

	es := f.incomeEvents(t)
	if len(es) != 1 || es[0].TaxTreatment == nil || *es[0].TaxTreatment != "exempt" {
		t.Fatalf("events = %+v", es)
	}
}

func TestRebuildAllRestoresUserWithoutDerivedRows(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.income(t, f.mxrf11, "dividend", 1000, f.dividends)
	f.incomeEvents(t)

	for _, table := range []string{"portfolio_position_day", "portfolio_realized_result", "portfolio_income_event"} {
		if _, err := f.h.Pool.Exec(t.Context(), "DELETE FROM "+table); err != nil {
			t.Fatal(err)
		}
	}

	if err := f.h.App.Portfolio.RebuildAll(t.Context()); err != nil {
		t.Fatal(err)
	}

	if es := f.incomeEvents(t); len(es) != 1 {
		t.Fatalf("events = %+v", es)
	}
}

func TestTaxYearRangeInResponses(t *testing.T) {
	t.Parallel()

	for _, region := range []string{"BR", "DE"} {
		t.Run(region, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t)
			f.moveToRegion(t, region)

			for _, path := range []string{"/api/v1/realized-results?year=2026", "/api/v1/income-events?year=2026"} {
				var out struct {
					From string `json:"from"`
					To   string `json:"to"`
				}
				f.h.MustDo(http.MethodGet, path, nil, http.StatusOK, &out)

				if out.From != "2026-01-01" || out.To != "2026-12-31" {
					t.Errorf(
						"%s range = %s to %s, want 2026-01-01 to 2026-12-31",
						path,
						out.From,
						out.To,
					)
				}
			}
		})
	}
}

// S412: a type edit rebuilds the derived rows, so a realized result takes the tax class of the
// new type (amendment A224).
func TestS412ReclassifyRebuildsTaxClass(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.trade(t, "buy", "2026-10-05", 150, "10.05", 490)
	f.trade(t, "sell", "2026-10-20", 50, "10.80", 210)

	if rs := f.results(t, "2026"); len(rs) != 1 || rs[0].TaxClass != "fii" {
		t.Fatalf("before = %+v", rs)
	}

	f.h.MustDo(
		http.MethodPatch,
		"/api/v1/instruments/MXRF11",
		map[string]any{"type": "etf", "name": "MXRF11", "exchange": "BVMF"},
		http.StatusOK,
		nil,
	)

	if rs := f.results(t, "2026"); len(rs) != 1 || rs[0].TaxClass != "etf" {
		t.Fatalf("after = %+v", rs)
	}
}
