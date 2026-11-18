package ledger_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/ledger"
)

func TestCostMethod(t *testing.T) {
	tests := []struct {
		name           string
		region         string
		instrumentType string
		want           string
	}{
		{
			name:           "BR fixed income sells oldest first",
			region:         "BR",
			instrumentType: "fixed_income",
			want:           "fifo",
		},
		{
			name:           "BR stock keeps the average",
			region:         "BR",
			instrumentType: "stock",
			want:           "average",
		},
		{name: "BR fund keeps the average", region: "BR", instrumentType: "fund", want: "average"},
		{
			name:           "region without a case keeps the average",
			region:         "NZ",
			instrumentType: "fixed_income",
			want:           "average",
		},
		{
			name:           "no region keeps the average",
			region:         "",
			instrumentType: "fixed_income",
			want:           "average",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ledger.CostMethod(tt.region, tt.instrumentType); got != tt.want {
				t.Errorf(
					"CostMethod(%q, %q) = %q, want %q",
					tt.region,
					tt.instrumentType,
					got,
					tt.want,
				)
			}
		})
	}
}

// FS4: only a taxed fixed income security of a Brazilian book has a withholding table.
func TestFixedIncomeWithholding(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		region, instrumentType, subtype string
		want                            bool
	}{
		{"BR", "fixed_income", "", true},
		{"BR", "fixed_income", "cdb", true},
		{"BR", "fixed_income", "lf", true},
		{"BR", "fixed_income", "xyz_bond", true},
		{"BR", "fixed_income", "lci", false},
		{"BR", "fixed_income", "debenture_incentivada", false},
		{"BR", "stock", "", false},
		{"BR", "fund", "multimarket", false},
		{"BR", "fund", "equity_fund", true},
		{"BR", "fund", "fip", true},
		{"BR", "fund", "fidc_entity", true},
		{"BR", "fund", "fidc", false},
		{"NZ", "fund", "equity_fund", false},
		{"NZ", "fixed_income", "cdb", false},
		{"", "fixed_income", "cdb", false},
	} {
		_, got := ledger.FixedIncomeWithholding(tc.region, tc.instrumentType, tc.subtype)
		if got != tc.want {
			t.Errorf("FixedIncomeWithholding(%q, %q, %q) = %v, want %v",
				tc.region, tc.instrumentType, tc.subtype, got, tc.want)
		}
	}
}
