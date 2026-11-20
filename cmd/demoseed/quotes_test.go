package main

import "testing"

func TestRawHistoryCovers(t *testing.T) {
	for _, tc := range []struct {
		name   string
		prices []sourcedPrice
		want   bool
	}{
		{
			name: "an official price in the first month covers the history",
			prices: []sourcedPrice{
				{"2016-11-03", "b3_cotahist"},
				{"2026-11-19", "b3_cotahist"},
			},
			want: true,
		},
		{
			name: "split-adjusted closes alone do not cover it",
			prices: []sourcedPrice{
				{"2016-11-01", "yahoo_chart"},
				{"2021-11-16", "b3_cotahist"},
			},
		},
		{
			name: "a fund listed after the start is covered from its listing",
			prices: []sourcedPrice{
				{"2021-05-24", "yahoo_chart"},
				{"2021-05-25", "b3_cotahist"},
			},
			want: true,
		},
		{
			name: "a bond is covered by the Tesouro Direto prices",
			prices: []sourcedPrice{
				{"2016-11-01", "tesouro_direto"},
			},
			want: true,
		},
		{name: "no price"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := rawHistoryCovers(tc.prices); got != tc.want {
				t.Errorf("rawHistoryCovers(%v) = %v, want %v", tc.prices, got, tc.want)
			}
		})
	}
}
