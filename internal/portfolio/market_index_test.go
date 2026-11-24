package portfolio_test

import (
	"net/http"
	"testing"
)

// enableMarketIndexes enables the S&P 500 and the Ibovespa, and the dollar index when withDollar,
// and stores their rates of the first days of 2026. The dollar rate of 2026-01-06 is after the last
// rate of the S&P 500.
func (b benchmarkBook) enableMarketIndexes(t *testing.T, withDollar bool) {
	t.Helper()

	ids := []string{"br_cdi", "br_ipca", "us_sp500", "br_ibovespa"}
	if withDollar {
		ids = append(ids, "br_ptax_usd")
	}

	for _, id := range ids {
		if _, err := b.h.Pool.Exec(
			t.Context(),
			`INSERT INTO marketdata_feed (id, enabled) VALUES ($1, true)
			ON CONFLICT (id) DO UPDATE SET enabled = true`,
			id,
		); err != nil {
			t.Fatal(err)
		}
	}

	if _, err := b.h.Pool.Exec(
		t.Context(),
		`INSERT INTO marketdata_index_rate (index_id, date, rate, source) VALUES
			('sp500', '2026-01-02', 0.01, 'us_sp500'),
			('sp500', '2026-01-05', 0.02, 'us_sp500'),
			('usd_brl', '2026-01-02', 0.01, 'br_ptax_usd'),
			('usd_brl', '2026-01-05', -0.01, 'br_ptax_usd'),
			('usd_brl', '2026-01-06', 0.5, 'br_ptax_usd'),
			('ibovespa', '2026-01-02', 0.03, 'br_ibovespa'),
			('ibovespa', '2026-01-07', -0.01, 'br_ibovespa')`,
	); err != nil {
		t.Fatal(err)
	}
}

// S706: the series draws each enabled market index beside the CDI, the S&P 500 in reais: its
// growth is 1.01 × 1.01 × 1.02 × 0.99 − 1 (MI8, PS8). Without the dollar index it is left out.
func TestS706MarketIndexesOfTheSeries(t *testing.T) {
	t.Parallel()

	for name, tt := range map[string]struct {
		dollar bool
		query  string
		want   map[string]int
	}{
		"dollar index":    {true, "step=day", map[string]int{"cdi": 33, "ibovespa": 197, "sp500": 301}},
		"no dollar index": {false, "step=day", map[string]int{"cdi": 33, "ibovespa": 197}},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			b := newBenchmarkBook(t)
			b.stockBrokerage(t, "27")
			b.enableMarketIndexes(t, tt.dollar)

			got := b.series(t, "2026-01-02", "2026-01-09", tt.query)
			if len(got.Indexes) != len(tt.want) {
				t.Fatalf("indexes = %+v, want %v", got.Indexes, tt.want)
			}

			for _, x := range got.Indexes {
				if last := x.Points[len(x.Points)-1]; last.ReturnBP != tt.want[x.Index] ||
					x.Period != "day" {
					t.Errorf("%s = %+v, want a last return of %d", x.Index, x, tt.want[x.Index])
				}
			}
		})
	}
}

// S706: a series valued in dollars takes the S&P 500 as it is and no index in reais.
func TestS706MarketIndexesInDollars(t *testing.T) {
	t.Parallel()

	b := newBenchmarkBookOn(t, "2025-11-01")
	b.addUSD(t)
	b.enableMarketIndexes(t, true)

	got := b.series(t, "2025-11-01", "2026-01-09", "step=month&value_in=USD")
	if len(got.Indexes) != 1 || got.Indexes[0].Index != "sp500" {
		t.Fatalf("indexes in USD = %+v, want the S&P 500 alone", got.Indexes)
	}

	points := got.Indexes[0].Points
	if last := points[len(points)-1]; last.ReturnBP != 302 {
		t.Errorf("last return = %d, want 302 (1.01 × 1.02 − 1)", last.ReturnBP)
	}
}

// S706: the return report compares with the S&P 500 in reais when it is named, and states the
// currency mismatch without the dollar index.
func TestS706ReturnAgainstTheSP500(t *testing.T) {
	t.Parallel()

	b := newBenchmarkBook(t)
	b.stockBrokerage(t, "27")
	b.enableMarketIndexes(t, true)

	r := b.compared(t, "2026-01-02", "2026-01-09", "sp500")
	if r.Benchmark == nil || r.Benchmark.Index != "sp500" || r.Benchmark.IndexBP != 301 ||
		r.Benchmark.Until != "2026-01-05" || r.Benchmark.PercentBP != nil {
		t.Fatalf("report = %+v", r)
	}

	b.h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/br_ptax_usd",
		map[string]any{"enabled": false},
		http.StatusOK,
		nil,
	)

	r = b.compared(t, "2026-01-02", "2026-01-09", "sp500")
	if r.Benchmark != nil || r.UnavailableReason != "currency_mismatch" {
		t.Fatalf("report without the dollar index = %+v", r)
	}
}
