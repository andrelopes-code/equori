package domain

import (
	"slices"
	"testing"
)

func TestDecideYields(t *testing.T) {
	t.Parallel()

	const own, reserve, review = YieldOwn, YieldReserve, YieldReview

	line := func(date string, amount int64) YieldLine {
		return YieldLine{Date: onDate(date), Amount: amount}
	}
	closed := func(date string, amount int64) YieldLine {
		return YieldLine{Date: onDate(date), Amount: amount, Closed: true}
	}
	held := func(date string, amount int64) YieldLine {
		return YieldLine{Date: onDate(date), Amount: amount, Held: true}
	}
	span := func(from, to string, amount int64) YieldSpan {
		return YieldSpan{From: onDate(from), To: onDate(to), Amount: amount}
	}
	gap := func(v int64) *int64 { return &v }

	tests := []struct {
		name  string
		lines []YieldLine
		spans []YieldSpan
		gap   *int64
		want  []YieldOutcome
	}{
		{
			name: "each reserve takes its line",
			lines: []YieldLine{
				line("2026-11-23", 9), line("2026-11-23", 55), line("2026-11-23", 434),
			},
			spans: []YieldSpan{
				span("2026-11-23", "2026-11-23", 55), span("2026-11-23", "2026-11-23", 434),
			},
			gap:  gap(9),
			want: []YieldOutcome{own, reserve, reserve},
		},
		{
			name:  "the balance holds every line",
			lines: []YieldLine{line("2026-11-23", 55)},
			spans: []YieldSpan{span("2026-11-23", "2026-11-23", 55)},
			gap:   gap(55),
			want:  []YieldOutcome{own},
		},
		{
			name:  "one of two equal lines is the reserve's",
			lines: []YieldLine{line("2026-11-23", 55), line("2026-11-23", 55)},
			spans: []YieldSpan{span("2026-11-23", "2026-11-23", 55)},
			gap:   gap(55),
			want:  []YieldOutcome{reserve, own},
		},
		{
			name: "a yield of two days",
			lines: []YieldLine{
				line("2026-11-19", 9), line("2026-11-19", 54),
				line("2026-11-20", 10), line("2026-11-20", 55),
			},
			spans: []YieldSpan{span("2026-11-19", "2026-11-20", 109)},
			gap:   gap(19),
			want:  []YieldOutcome{own, reserve, own, reserve},
		},
		{
			name:  "two choices match none",
			lines: []YieldLine{line("2026-11-19", 5), line("2026-11-20", 5)},
			spans: []YieldSpan{span("2026-11-19", "2026-11-20", 5)},
			gap:   gap(0),
			want:  []YieldOutcome{review, review},
		},
		{
			name:  "a line outside the span is not the reserve's",
			lines: []YieldLine{line("2026-11-20", 55)},
			spans: []YieldSpan{span("2026-11-21", "2026-11-23", 55)},
			gap:   gap(0),
			want:  []YieldOutcome{review},
		},
		{
			name:  "no balance to decide by",
			lines: []YieldLine{line("2026-11-23", 9), line("2026-11-23", 55)},
			spans: []YieldSpan{span("2026-11-23", "2026-11-23", 55)},
			want:  []YieldOutcome{own, reserve},
		},
		{
			name:  "the balance leaves out a line no reserve explains",
			lines: []YieldLine{line("2026-11-23", 9), line("2026-11-23", 2)},
			gap:   gap(9),
			want:  []YieldOutcome{own, review},
		},
		{
			name:  "a balance that explains no line",
			lines: []YieldLine{line("2026-11-23", 9)},
			gap:   gap(-991),
			want:  []YieldOutcome{review},
		},
		{
			name:  "a closed line is the reserve's or waits",
			lines: []YieldLine{closed("2026-11-16", 55), closed("2026-11-16", 12)},
			spans: []YieldSpan{span("2026-11-16", "2026-11-16", 55)},
			gap:   gap(0),
			want:  []YieldOutcome{reserve, review},
		},
		{
			name:  "a closed line is never the account's",
			lines: []YieldLine{closed("2026-11-16", 12)},
			want:  []YieldOutcome{review},
		},
		{
			name:  "a held line joins when the new lines do not sum to the gap",
			lines: []YieldLine{held("2026-11-20", 9), line("2026-11-23", 10)},
			gap:   gap(19),
			want:  []YieldOutcome{own, own},
		},
		{
			name:  "a held line stays when the new lines sum to the gap",
			lines: []YieldLine{held("2026-11-20", 2), line("2026-11-23", 10)},
			gap:   gap(10),
			want:  []YieldOutcome{review, own},
		},
		{
			name:  "a held line takes a yield booked later",
			lines: []YieldLine{held("2026-11-20", 55)},
			spans: []YieldSpan{span("2026-11-20", "2026-11-20", 55)},
			gap:   gap(0),
			want:  []YieldOutcome{reserve},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := DecideYields(tt.lines, tt.spans, tt.gap); !slices.Equal(got, tt.want) {
				t.Fatalf("DecideYields = %v, want %v", got, tt.want)
			}
		})
	}
}
