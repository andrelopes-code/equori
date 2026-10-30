package domain

import (
	"maps"
	"slices"
	"testing"
	"time"
)

func TestRepeats(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		lines    []RepeatLine
		recorded []RepeatLine
		want     []int
	}{
		{
			name:     "payment under a second id",
			lines:    []RepeatLine{payment("b", 5, 78465)},
			recorded: []RepeatLine{payment("a", 5, 78465)},
			want:     []int{0},
		},
		{
			name:     "untyped credit repeats a payment 3 days away",
			lines:    []RepeatLine{credit("b", 8, 78465)},
			recorded: []RepeatLine{payment("a", 5, 78465)},
			want:     []int{0},
		},
		{
			name:     "payment repeats an untyped credit",
			lines:    []RepeatLine{payment("b", 5, 78465)},
			recorded: []RepeatLine{credit("a", 4, 78465)},
			want:     []int{0},
		},
		{
			name:     "4 days apart",
			lines:    []RepeatLine{payment("b", 9, 78465)},
			recorded: []RepeatLine{payment("a", 5, 78465)},
		},
		{
			name:     "other amount",
			lines:    []RepeatLine{payment("b", 5, 78464)},
			recorded: []RepeatLine{payment("a", 5, 78465)},
		},
		{
			name:     "two credits without a payment",
			lines:    []RepeatLine{credit("b", 5, 3000)},
			recorded: []RepeatLine{credit("a", 5, 3000)},
		},
		{
			name:     "charges",
			lines:    []RepeatLine{{ExternalID: "b", Date: day(5), Amount: -78465, Kind: KindPayment}},
			recorded: []RepeatLine{{ExternalID: "a", Date: day(5), Amount: -78465, Kind: KindPayment}},
		},
		{
			name:     "a recorded payment is repeated once",
			lines:    []RepeatLine{payment("b", 5, 78465), payment("c", 6, 78465)},
			recorded: []RepeatLine{payment("a", 5, 78465)},
			want:     []int{0},
		},
		{
			name:  "one read: the payment is kept, the credit repeats it",
			lines: []RepeatLine{credit("a", 5, 78465), payment("b", 5, 78465)},
			want:  []int{0},
		},
		{
			name:  "one read: the earlier external id is kept",
			lines: []RepeatLine{payment("b", 5, 78465), payment("a", 5, 78465)},
			want:  []int{0},
		},
		{
			name:     "the earlier line repeats",
			lines:    []RepeatLine{credit("c", 7, 78465), credit("b", 5, 78465)},
			recorded: []RepeatLine{payment("a", 5, 78465)},
			want:     []int{1},
		},
	}
	for _, tc := range tests {
		got := slices.Sorted(maps.Keys(Repeats(tc.lines, tc.recorded)))
		if !slices.Equal(got, tc.want) {
			t.Errorf("%s: Repeats = %v, want %v", tc.name, got, tc.want)
		}
	}
}

func payment(id string, d int, amount int64) RepeatLine {
	return RepeatLine{ExternalID: id, Date: day(d), Amount: amount, Kind: KindPayment}
}

func credit(id string, d int, amount int64) RepeatLine {
	return RepeatLine{ExternalID: id, Date: day(d), Amount: amount}
}

func day(d int) time.Time {
	return time.Date(2026, 11, d, 0, 0, 0, 0, time.UTC)
}
