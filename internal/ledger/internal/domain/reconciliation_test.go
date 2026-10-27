package domain

import (
	"errors"
	"testing"
)

func TestDecideAssertion(t *testing.T) {
	t.Parallel()
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
	t.Parallel()
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

func TestYieldBound(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		settled int64
		days    int
		percent int64
		want    int64
	}{
		{"one day rounds down", 100292, 1, 3, 100},
		{"exact one day", 100000, 1, 3, 100},
		{"one below the next unit", 99999, 1, 3, 99},
		{"thirty days", 100000, 30, 3, 3000},
		{"three days", 102000, 3, 3, 306},
		{"zero days count as one", 100000, 0, 3, 100},
		{"zero balance", 0, 5, 3, 0},
		{"negative balance", -5, 5, 3, 0},
		{"largest balance and span", 9007199254740991, 36500, 3, 328762772798046171},
		{"no rate", 100000, 30, 0, 0},
	}
	for _, tt := range tests {
		if got := YieldBound(tt.settled, tt.days, tt.percent); got != tt.want {
			t.Errorf("%s: YieldBound(%d, %d, %d) = %d, want %d", tt.name, tt.settled, tt.days, tt.percent, got, tt.want)
		}
	}
}

func TestDecideSyncedReserve(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name              string
		asserted, settled int64
		days              int
		mode              YieldMode
		want              AssertionOutcome
	}{
		{"within the bound", 100352, 100292, 1, YieldAuto, AssertionOutcome{Difference: 60, Resolution: ResolutionYield, Yield: 60}},
		{"at the bound", 100392, 100292, 1, YieldAuto, AssertionOutcome{Difference: 100, Resolution: ResolutionYield, Yield: 100}},
		{"one above the bound", 100393, 100292, 1, YieldAuto, AssertionOutcome{Difference: 101}},
		{"below the settled balance", 100200, 100292, 1, YieldAuto, AssertionOutcome{Difference: -92}},
		{"no previous assertion", 100352, 100292, 0, YieldAuto, AssertionOutcome{Difference: 60}},
		{"yield mode none", 100352, 100292, 1, YieldNone, AssertionOutcome{Difference: 60}},
		{"equal without a previous assertion", 100292, 100292, 0, YieldAuto, AssertionOutcome{Resolution: ResolutionNone}},
		{"equal with yield mode none", 100292, 100292, 1, YieldNone, AssertionOutcome{Resolution: ResolutionNone}},
	}
	const percent = 3
	for _, tt := range tests {
		if got := DecideSyncedReserve(tt.asserted, tt.settled, tt.days, tt.mode, percent); got != tt.want {
			t.Errorf("%s: %+v, want %+v", tt.name, got, tt.want)
		}
	}
	// A currency without a bound books no yield: the difference stays open for the owner.
	if got := DecideSyncedReserve(100352, 100292, 1, YieldAuto, 0); got != (AssertionOutcome{Difference: 60}) {
		t.Errorf("without a bound: %+v, want the difference open", got)
	}
}
