package index_test

import (
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/index"
)

func day(d int) time.Time { return time.Date(2026, time.January, d, 0, 0, 0, 0, time.UTC) }

func TestChanges(t *testing.T) {
	t.Parallel()

	levels := []index.Level{
		{Date: day(2), Value: "100"},
		{Date: day(5), Value: "102"},
		{Date: day(6), Value: "100.98"},
		{Date: day(7), Value: "104"},
	}

	got, err := index.Changes(levels, day(6))
	if err != nil {
		t.Fatal(err)
	}

	want := []index.Rate{
		{Date: day(6), Value: "-0.010000000000"},
		{Date: day(7), Value: "0.029906912260"},
	}
	if !slices.Equal(got, want) {
		t.Errorf("rates = %v, want %v", got, want)
	}
}

func TestChangesRefusesALevelOfZero(t *testing.T) {
	t.Parallel()

	levels := []index.Level{{Date: day(2), Value: "100"}, {Date: day(5), Value: "0"}}
	if _, err := index.Changes(levels, day(2)); err == nil {
		t.Error("a level of 0 was accepted")
	}
}
