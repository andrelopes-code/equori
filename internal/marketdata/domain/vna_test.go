package domain

import (
	"testing"
	"time"
)

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

// A VNA on a day counts the months from the base to the month before; a missing month leaves no VNA.
func TestMonthlyRates(t *testing.T) {
	t.Parallel()

	base := time.Date(2000, time.July, 1, 0, 0, 0, 0, time.UTC)
	rates := []IndexRate{
		{Date: base, Rate: "0.01"},
		{Date: base.AddDate(0, 1, 0), Rate: "0.02"},
		{Date: base.AddDate(0, 2, 0), Rate: "0.03"},
	}

	got, ok := MonthlyRates(rates, base, time.Date(2000, time.September, 15, 0, 0, 0, 0, time.UTC))
	if !ok || len(got) != 2 || got[1] != "0.02" {
		t.Errorf("MonthlyRates = %v, %v; want July and August", got, ok)
	}

	if _, ok := MonthlyRates(rates[1:], base, base.AddDate(0, 3, 0)); ok {
		t.Error("a missing July gave a VNA")
	}

	if _, ok := MonthlyRates(
		rates,
		base,
		time.Date(2001, time.January, 15, 0, 0, 0, 0, time.UTC),
	); ok {
		t.Error("months not yet stored gave a VNA")
	}
}
