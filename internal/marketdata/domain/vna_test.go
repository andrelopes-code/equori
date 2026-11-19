package domain

import "testing"

// The examples of the Metodologia de Cálculo dos Títulos Públicos Federais (Tesouro Nacional,
// version of 2024-04-29): the VNA of an NTN-B on 2008-05-15 from the IPCA numbers of June 2000
// and April 2008, its coupon, and the coupon of an NTN-C on its VNA of 2008-04-01.
func TestVNAAndBondInterest(t *testing.T) {
	t.Parallel()

	vna, err := VNA([]string{"0.72692645947653317809"})
	if err != nil || vna != "1726.926459000000" {
		t.Fatalf("VNA = %q, %v; want 1726.926459000000", vna, err)
	}

	for _, tc := range []struct{ vna, factor, want string }{
		{"1726.926459", "0.02956301", "51.053144000000"},
		{"2088.388799", "0.02956301", "61.739058000000"},
	} {
		if got, err := BondInterest(tc.vna, tc.factor); err != nil || got != tc.want {
			t.Errorf("BondInterest(%s, %s) = %q, %v; want %s", tc.vna, tc.factor, got, err, tc.want)
		}
	}

	if _, err := VNA(nil); err == nil {
		t.Error("VNA of no rate: no error")
	}
}
