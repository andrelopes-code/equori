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
