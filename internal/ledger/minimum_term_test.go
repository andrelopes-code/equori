package ledger_test

import (
	"net/http"
	"testing"
)

// S630 (coverage rows F-07, F-10): a new LCI or LCA without redeemable_from takes the minimum
// term the rule of its issue date sets (Resolução CMN 5.119/2024 and 5.215/2025); an LF and a
// DPGE take their maturity; a date typed stays.
func TestMinimumTermOfLCIAndLCA(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name, subtype, index, issuedOn, maturesOn, typed, want string
	}{
		{"LCI of today", "lci", "cdi", "2026-03-02", "2028-03-02", "", "2026-09-02"},
		{"LCI on IPCA", "lci", "ipca", "2026-03-02", "2030-03-02", "", "2029-03-02"},
		{"LCA of 2024", "lca", "cdi", "2024-06-03", "2027-06-03", "", "2025-03-03"},
		{"LCI of 2024", "lci", "cdi", "2024-06-03", "2027-06-03", "", "2025-06-03"},
		{"typed", "lca", "cdi", "2026-03-02", "2028-03-02", "2026-12-01", "2026-12-01"},
		{"CDB", "cdb", "cdi", "2026-03-02", "2028-03-02", "", ""},
		// Coverage row F-10: an LF, senior or subordinated, and a DPGE redeem at maturity only.
		{"LF", "lf", "cdi", "2026-03-02", "2028-03-02", "", "2028-03-02"},
		{"LF subordinated", "lf_subordinated", "cdi", "2026-03-02", "2031-03-03", "", "2031-03-03"},
		{"DPGE", "dpge", "cdi", "2026-03-02", "2028-03-02", "", "2028-03-02"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			f := newInvestFixture(t)

			body := f.newContractBody(tc.issuedOn, 1000000)
			contract := body["contract"].(map[string]any)
			contract["subtype"], contract["index_id"] = tc.subtype, tc.index
			contract["matures_on"] = tc.maturesOn
			delete(contract, "percent_of_index_bp")

			if tc.index == "ipca" {
				contract["spread_bp"] = 600
			}

			if tc.typed != "" {
				contract["redeemable_from"] = tc.typed
			}

			var out fixedIncomeOut
			f.h.MustDo(http.MethodPost, fixedIncomePath, body, http.StatusCreated, &out)

			var terms struct {
				RedeemableFrom string `json:"redeemable_from"`
			}
			f.h.MustDo(
				http.MethodGet,
				"/api/v1/instruments/"+out.Instrument+"/terms",
				nil,
				http.StatusOK,
				&terms,
			)

			if terms.RedeemableFrom != tc.want {
				t.Errorf("redeemable_from = %q, want %q", terms.RedeemableFrom, tc.want)
			}
		})
	}
}
