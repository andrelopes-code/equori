package portfolio_test

import (
	"net/http"
	"slices"
	"testing"
)

// defineWithSubtype defines a security with a subtype and a brokerage child that holds it.
func (f fixture) defineWithSubtype(t *testing.T, code, typ, subtype string) string {
	t.Helper()

	body := security(code, typ)
	if subtype != "" {
		body["subtype"] = subtype
	}

	f.h.MustDo(http.MethodPost, "/api/v1/instruments", body, http.StatusCreated, nil)

	return f.h.Account(
		"XP "+code,
		"asset",
		"brokerage",
		map[string]any{"institution_id": f.institution, "parent_id": f.xp, "currency": code},
	)
}

func (f fixture) subtypes(t *testing.T, typ string) []string {
	t.Helper()
	var out struct {
		Items []string `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/instrument-subtypes?type="+typ, nil, http.StatusOK, &out)

	return out.Items
}

// S122: the tax treatment of a coupon follows the subtype of the security (amendment A122).
func TestS122SubtypeTaxClass(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	cri := f.defineWithSubtype(t, "CRIXPTO", "fixed_income", "cri")
	cdb := f.defineWithSubtype(t, "CDBXPTO", "fixed_income", "cdb")
	plain := f.defineWithSubtype(t, "NTNPLAIN", "fixed_income", "")
	other := f.defineWithSubtype(t, "XYZSTOCK", "stock", "xyz_bond")
	f.income(t, cri, "coupon", 1000, f.jcp)
	f.income(t, cdb, "coupon", 1000, f.jcp)
	f.income(t, plain, "coupon", 1000, f.jcp)
	f.income(t, other, "coupon", 1000, f.jcp)
	f.income(t, f.petr4, "jcp", 4500, f.jcp)
	f.h.Dispatch()
	var out struct {
		Items []struct {
			Instrument   string  `json:"instrument"`
			TaxTreatment *string `json:"tax_treatment"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/income-events?year=2026", nil, http.StatusOK, &out)

	got := map[string]string{}
	for _, e := range out.Items {
		if e.TaxTreatment == nil {
			t.Fatalf("%s has no treatment: %+v", e.Instrument, out.Items)
		}

		got[e.Instrument] = *e.TaxTreatment
	}

	want := map[string]string{
		"CRIXPTO":  "exempt",
		"CDBXPTO":  "exclusive",
		"NTNPLAIN": "exclusive",
		"XYZSTOCK": "exclusive",
		"PETR4":    "exclusive",
	}
	for code, treatment := range want {
		if got[code] != treatment {
			t.Errorf("%s treatment = %q, want %q (all: %v)", code, got[code], treatment, got)
		}
	}
}

// S459 (FS-S4): the fixed income subtypes of a Brazilian book include lc, lf and debenture.
func TestInstrumentSubtypesList(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	if got, want := f.subtypes(
		t,
		"fixed_income",
	), []string{
		"cdb",
		"cdca",
		"cpr",
		"cra",
		"cri",
		"debenture",
		"debenture_incentivada",
		"dpge",
		"lam",
		"lc",
		"lca",
		"lcd",
		"lci",
		"lf",
		"lh",
		"lig",
		"nota_comercial",
		"rdb",
		"tesouro",
	}; !slices.Equal(
		got,
		want,
	) {
		t.Errorf("fixed_income = %v, want %v", got, want)
	}

	if got, want := f.subtypes(
		t,
		"fund",
	), []string{
		"equity_fund",
		"fixed_income_fund",
		"multimarket",
		"pgbl",
		"vgbl",
	}; !slices.Equal(
		got,
		want,
	) {
		t.Errorf("fund = %v, want %v", got, want)
	}

	if got := f.subtypes(t, "stock"); len(got) != 0 {
		t.Errorf("stock = %v, want none", got)
	}

	f.h.ExpectProblem(
		f.h.Do(http.MethodGet, "/api/v1/instrument-subtypes?type=bond", nil),
		http.StatusBadRequest,
		"invalid_request",
		"type",
	)

	f.moveToRegion(t, "DE")

	if got := f.subtypes(t, "fixed_income"); len(got) != 0 {
		t.Errorf("fixed_income without a jurisdiction = %v, want none", got)
	}
}

// S458 (FS-S3): the distribution of a listed FII is exempt; the distribution of another class is
// taxed at source (A235 FS2).
func TestS458FIIDistributionIsExempt(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.income(t, f.mxrf11, "distribution", 1000, f.dividends)
	f.h.Dispatch()

	var out struct {
		Items []struct {
			Instrument   string  `json:"instrument"`
			TaxTreatment *string `json:"tax_treatment"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/income-events?year=2026", nil, http.StatusOK, &out)

	if len(out.Items) != 1 || out.Items[0].TaxTreatment == nil ||
		*out.Items[0].TaxTreatment != "exempt" {
		t.Fatalf("income events = %+v, want one exempt distribution", out.Items)
	}
}
