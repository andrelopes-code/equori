package app

import (
	"math"
	"testing"
	"time"
)

func TestConvertedRates(t *testing.T) {
	t.Parallel()

	day := func(d int) time.Time { return time.Date(2026, time.January, d, 0, 0, 0, 0, time.UTC) }
	rate := func(d int, r float64) IndexRate { return IndexRate{Date: day(d), Rate: r} }

	for name, tt := range map[string]struct {
		from            time.Time
		rates, exchange []IndexRate
		want            []IndexRate
	}{
		"the same days": {
			day(5),
			[]IndexRate{rate(5, 0.01), rate(6, -0.02)},
			[]IndexRate{rate(5, 0.10), rate(6, 0.05)},
			[]IndexRate{rate(5, 0.111), rate(6, 0.029)},
		},
		"a closed market on each side": {
			day(5),
			[]IndexRate{rate(6, 0.01), rate(8, 0.01)},
			[]IndexRate{rate(5, 0.10), rate(7, 0.05)},
			[]IndexRate{rate(5, 0.10), rate(6, 0.01), rate(7, 0.05), rate(8, 0.01)},
		},
		"an exchange published before the index": {
			day(5),
			[]IndexRate{rate(5, 0.01)},
			[]IndexRate{rate(5, 0.10), rate(6, 0.05)},
			[]IndexRate{rate(5, 0.111)},
		},
		"an index that starts later": {
			day(1),
			[]IndexRate{rate(20, 0.01)},
			[]IndexRate{rate(5, 0.10), rate(20, 0.05)},
			[]IndexRate{rate(20, 0.0605)},
		},
		"no rate of the index": {day(1), nil, []IndexRate{rate(5, 0.10)}, nil},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got := convertedRates(tt.from, tt.rates, tt.exchange)
			if len(got) != len(tt.want) {
				t.Fatalf("rates = %v, want %v", got, tt.want)
			}

			for i, w := range tt.want {
				if !got[i].Date.Equal(w.Date) || math.Abs(got[i].Rate-w.Rate) > 1e-12 {
					t.Errorf("rate %d = %v, want %v", i, got[i], w)
				}
			}
		})
	}
}
