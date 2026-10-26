//go:build perf

package main

import (
	"bufio"
	"net/http"
	"os"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"
)

const (
	perfCalls   = 50
	perfP95     = 200 * time.Millisecond // N05
	perfBalance = 50 * time.Millisecond  // N06
	perfRSS     = 256 << 20              // N09, bytes
)

// p95 sends GET path perfCalls times and returns the 95th percentile of the latency.
func p95(t *testing.T, s *seeder, path string) time.Duration {
	t.Helper()
	took := make([]time.Duration, perfCalls)
	for i := range took {
		start := time.Now()
		s.do(http.MethodGet, path, nil, nil)
		took[i] = time.Since(start)
	}
	if s.err != nil {
		t.Fatal(s.err)
	}
	slices.Sort(took)
	return took[perfCalls*95/100-1]
}

// rss reads VmRSS of this process. The test process holds the HTTP server, the
// seeder and the test runtime together, so the figure bounds the server's own RSS.
func rss(t *testing.T) int64 {
	t.Helper()
	f, err := os.Open("/proc/self/status")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		if rest, ok := strings.CutPrefix(sc.Text(), "VmRSS:"); ok {
			kib, err := strconv.ParseInt(strings.TrimSuffix(strings.TrimSpace(rest), " kB"), 10, 64)
			if err != nil {
				t.Fatal(err)
			}
			return kib << 10
		}
	}
	t.Fatal("no VmRSS in /proc/self/status")
	return 0
}

// N05, N06, N09 on the demo dataset (docs/operations/performance.md).
func TestPerformanceOnDemoDataset(t *testing.T) {
	s, cfg, h := seedHarness(t)
	if err := seed(s, cfg); err != nil {
		t.Fatal(err)
	}
	h.Dispatch()
	year := cfg.today.AddDate(-1, 0, 1).Format(time.DateOnly)
	today := cfg.today.Format(time.DateOnly)
	checking, card := s.id("itau.checking"), s.id("card.itau")

	lists := []struct{ name, path string }{
		{"transactions", "/transactions?limit=50"},
		{"accounts", "/accounts?limit=50"},
		{"statements", "/accounts/" + card + "/statements?limit=50"},
		{"category totals, accrual", "/reports/categories?class=expense&view=accrual&from=" + year + "&to=" + today},
		{"category totals, cash", "/reports/categories?class=expense&view=cash&from=" + year + "&to=" + today},
		{"net worth", "/reports/net-worth?date=" + today},
	}
	for _, l := range lists {
		got := p95(t, s, l.path)
		t.Logf("N05 %s: p95 %v", l.name, got)
		if got >= perfP95 {
			t.Errorf("N05 %s: p95 %v, want below %v", l.name, got, perfP95)
		}
	}

	balance := p95(t, s, "/accounts/"+checking+"/balance?date="+year)
	t.Logf("N06 balance at a date: p95 %v", balance)
	if balance >= perfBalance {
		t.Errorf("N06 balance at a date: p95 %v, want below %v", balance, perfBalance)
	}

	mem := rss(t)
	t.Logf("N09 VmRSS of the test process: %d MiB", mem>>20)
	if mem >= perfRSS {
		t.Errorf("N09 VmRSS %d MiB, want below %d MiB", mem>>20, perfRSS>>20)
	}
}
