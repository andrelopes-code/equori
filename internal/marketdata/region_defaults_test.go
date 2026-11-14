package marketdata_test

import (
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata"
)

func TestRoundLotCode(t *testing.T) {
	t.Parallel()

	tests := []struct {
		mic, code string
		want      string
		ok        bool
	}{
		{"BVMF", "PIBB11F", "PIBB11", true},
		{"BVMF", "PETR4F", "PETR4", true},
		{"BVMF", "PETR4", "", false},
		{"BVMF", "TAEE11F", "TAEE11", true},
		{"BVMF", "F", "", false},
		{"BVMF", "ABCDF", "", false},
		{"XNAS", "AAPLF", "", false},
	}

	for _, tc := range tests {
		got, ok := marketdata.RoundLotCode(tc.mic, tc.code)
		if got != tc.want || ok != tc.ok {
			t.Errorf("RoundLotCode(%q, %q) = (%q, %v), want (%q, %v)",
				tc.mic, tc.code, got, ok, tc.want, tc.ok)
		}
	}
}

func TestSettlementCycle(t *testing.T) {
	t.Parallel()

	tests := []struct {
		mic  string
		date string
		days int
		cal  string
		ok   bool
	}{
		{"BVMF", "2019-05-24", 3, "br_banking", true},
		{"BVMF", "2019-05-27", 2, "br_banking", true},
		{"XNAS", "2026-11-19", 0, "", false},
	}

	for _, tc := range tests {
		date, err := time.Parse(time.DateOnly, tc.date)
		if err != nil {
			t.Fatal(err)
		}

		days, cal, ok := marketdata.SettlementCycle(tc.mic, date)
		if days != tc.days || cal != tc.cal || ok != tc.ok {
			t.Errorf("SettlementCycle(%q, %s) = (%d, %q, %v), want (%d, %q, %v)",
				tc.mic, tc.date, days, cal, ok, tc.days, tc.cal, tc.ok)
		}
	}
}
