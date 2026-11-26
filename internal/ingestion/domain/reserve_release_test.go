package domain

import (
	"slices"
	"testing"
	"time"
)

func TestPairReleases(t *testing.T) {
	t.Parallel()

	at := time.Date(2026, 11, 26, 14, 11, 51, 11_000_000, time.UTC)
	ms := func(n int) time.Time { return at.Add(time.Duration(n) * time.Millisecond) }

	for _, tt := range []struct {
		name        string
		releases    []PairLine
		withdrawals []PairLine
		want        []int
	}{
		{
			"one pair",
			[]PairLine{{At: at, Amount: -99748}},
			[]PairLine{{At: ms(211), Amount: 98044}},
			[]int{0},
		},
		{
			"equal amounts and the window's end",
			[]PairLine{{At: at, Amount: -50000}},
			[]PairLine{{At: ms(2000), Amount: 50000}},
			[]int{0},
		},
		{
			"after the window",
			[]PairLine{{At: at, Amount: -99748}},
			[]PairLine{{At: ms(2001), Amount: 98044}},
			[]int{-1},
		},
		{
			"withdrawal before the release",
			[]PairLine{{At: at, Amount: -99748}},
			[]PairLine{{At: ms(-1), Amount: 98044}},
			[]int{-1},
		},
		{
			"withdrawal above the release",
			[]PairLine{{At: at, Amount: -99748}},
			[]PairLine{{At: ms(211), Amount: 99749}},
			[]int{-1},
		},
		{
			"no timestamp",
			[]PairLine{{Amount: -99748}},
			[]PairLine{{Amount: 98044}},
			[]int{-1},
		},
		{
			"two withdrawals in the window",
			[]PairLine{{At: at, Amount: -99748}},
			[]PairLine{{At: ms(211), Amount: 98044}, {At: ms(1500), Amount: 98044}},
			[]int{-1},
		},
		{
			"two releases claim one withdrawal",
			[]PairLine{{At: at, Amount: -99748}, {At: ms(100), Amount: -99748}},
			[]PairLine{{At: ms(211), Amount: 98044}},
			[]int{-1, -1},
		},
		{
			"two separate pairs",
			[]PairLine{{At: at, Amount: -99748}, {At: ms(1_000_000), Amount: -1990}},
			[]PairLine{{At: ms(1_000_243), Amount: 1956}, {At: ms(211), Amount: 98044}},
			[]int{1, 0},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := PairReleases(tt.releases, tt.withdrawals)

			if !slices.Equal(got, tt.want) {
				t.Fatalf("PairReleases = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestReserveConfirms(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name                               string
		reported, settled, released, bound int64
		want                               bool
	}{
		{"the amount the pairs leave", 252, 100000, 99748, 100, true},
		{"the yield of the day within the bound", 307, 100000, 99748, 100, true},
		{"the whole reserve and its yield", 0, 101683, 101738, 101, true},
		{"the bound itself", 352, 100000, 99748, 100, true},
		{"above the bound", 1956, 100000, 99748, 100, false},
		{"below the amount the pairs leave", 251, 100000, 99748, 100, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := ReserveConfirms(tt.reported, tt.settled, tt.released, tt.bound)

			if got != tt.want {
				t.Fatalf("ReserveConfirms = %v, want %v", got, tt.want)
			}
		})
	}
}
