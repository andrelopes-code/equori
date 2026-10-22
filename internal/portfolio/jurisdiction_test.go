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
		"account_id": account, "cash_account_id": f.cash, "income_type": typ, "date": "2026-10-26", "gross": apitest.BRL(gross), "category_id": category,
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
	if _, err := f.h.Pool.Exec(t.Context(), `UPDATE identity_user SET region = $1`, region); err != nil {
		t.Fatal(err)
	}
}

func TestJurisdictionBRTreatments(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.income(t, f.mxrf11, "dividend", 1000, f.dividends)
	f.income(t, f.petr4, "jcp", 4500, f.jcp)
	es := f.incomeEvents(t)
	if len(es) != 2 || es[0].TaxTreatment == nil || *es[0].TaxTreatment != "exempt" || es[1].TaxTreatment == nil || *es[1].TaxTreatment != "exclusive" {
		t.Fatalf("events = %+v", es)
	}
	if got, want := f.incomeTypes(t), []string{"coupon", "distribution", "dividend", "interest", "jcp"}; !slices.Equal(got, want) {
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
	if len(es) != 2 || es[0].IncomeType != "dividend" || es[0].TaxTreatment != nil || es[1].IncomeType != "jcp" || es[1].TaxTreatment != nil {
		t.Fatalf("events = %+v", es)
	}
	if got, want := f.incomeTypes(t), []string{"coupon", "distribution", "dividend", "interest"}; !slices.Equal(got, want) {
		t.Fatalf("types = %v, want %v", got, want)
	}
}

func TestIncomeTypeMustBeAnIdentifier(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	r := f.h.Do(http.MethodPost, "/api/v1/investment-income", map[string]any{
		"account_id": f.mxrf11, "cash_account_id": f.cash, "income_type": "Bad!", "date": "2026-10-26", "gross": apitest.BRL(1000), "category_id": f.dividends,
	})
	f.h.ExpectProblem(r, http.StatusBadRequest, "invalid_request", "income_type")
}

func TestRebuildAllRestoresTaxData(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.income(t, f.mxrf11, "dividend", 1000, f.dividends)
	f.incomeEvents(t)
	if _, err := f.h.Pool.Exec(t.Context(), `UPDATE portfolio_income_event SET tax_treatment = NULL`); err != nil {
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
