package domain

import (
	"errors"
	"testing"
)

func TestDecideAssertion(t *testing.T) {
	tests := []struct {
		name              string
		asserted, settled int64
		mode              YieldMode
		want              AssertionOutcome
	}{
		{"equal", 1000000, 1000000, YieldAuto, AssertionOutcome{Difference: 0, Resolution: ResolutionNone}},
		{"positive with auto yield", 1008341, 1000000, YieldAuto, AssertionOutcome{Difference: 8341, Resolution: ResolutionYield, Yield: 8341}},
		{"positive without yield", 1008341, 1000000, YieldNone, AssertionOutcome{Difference: 8341}},
		{"negative on reserve", 999000, 1000000, YieldAuto, AssertionOutcome{Difference: -1000}},
	}
	for _, tt := range tests {
		if got := DecideAssertion(tt.asserted, tt.settled, tt.mode); got != tt.want {
			t.Errorf("%s: %+v, want %+v", tt.name, got, tt.want)
		}
	}
}

func TestCheckAssertionDate(t *testing.T) {
	last := day("2026-10-31")
	if err := CheckAssertionDate(day("2026-10-30"), &last); !errors.Is(err, ErrAlreadyReconciled) {
		t.Fatalf("earlier date err = %v", err)
	}
	for _, d := range []string{"2026-10-31", "2026-11-30"} {
		if err := CheckAssertionDate(day(d), &last); err != nil {
			t.Fatalf("%s: %v", d, err)
		}
	}
	if err := CheckAssertionDate(day("2026-01-01"), nil); err != nil {
		t.Fatal(err)
	}
}
