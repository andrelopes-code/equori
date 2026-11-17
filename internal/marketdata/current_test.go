package marketdata_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	currentAAPL  = "/yahoo/AAPL"
	currentBRL   = "/yahoo/BRLUSD=X"
	currentFetch = "2026-11-12T15:12:00Z"
)

// S562: a current quote values an amount while it is fresh and later than the close, and a read
// never waits for a source past CurrentBound (A248 CQ12, CQ14, CQ17, CQ19).
func TestS562CurrentQuoteIsCachedAndBounded(t *testing.T) {
	t.Parallel()

	h := newCurrentHarness(t, usProfile(), newCurrentFake(t, false))
	manual := "AAPL/USD 2026-11-11 173.73 manual"
	quote := "AAPL/USD 2026-11-12 154.122 yahoo_chart at " + currentFetch + " open"

	h.expect(t, "USD 173.73", []string{manual}, 0)

	h.warm(t, "AAPL")
	h.expect(t, "USD 154.12", []string{quote}, 1)

	got, err := h.App.Marketdata.Convert(t.Context(), h.amount(t), "USD", day("2026-11-12"))
	if err != nil {
		t.Fatal(err)
	}

	h.check(t, got, "USD 173.73", []string{manual})

	h.clock.add(59 * time.Second)
	h.warm(t, "AAPL")
	h.expect(t, "USD 154.12", []string{quote}, 1)

	h.clock.add(time.Second)
	h.expect(t, "USD 173.73", []string{manual}, 1)

	h.warm(t, "AAPL")
	h.expect(t, "USD 154.12", []string{quote}, 2)

	h.recordManual(t, "AAPL", "USD", "2026-11-12", "150")
	h.expect(t, "USD 150.00", []string{"AAPL/USD 2026-11-12 150 manual"}, 2)
}

// CQ13: a 429 pauses the source for 15 minutes.
func TestCurrentQuotePausesAfter429(t *testing.T) {
	t.Parallel()

	fake := newCurrentFake(t, false)
	fake.status.Store(http.StatusTooManyRequests)

	h := newCurrentHarness(t, usProfile(), fake)
	manual := "AAPL/USD 2026-11-11 173.73 manual"

	h.warm(t, "AAPL")
	h.expect(t, "USD 173.73", []string{manual}, 1)

	h.clock.add(14*time.Minute + 59*time.Second)
	h.warm(t, "AAPL")
	h.expectRequests(t, 1)

	h.clock.add(time.Second)
	h.warm(t, "AAPL")
	h.expectRequests(t, 2)
}

// CQ12: a failed pair waits 60 seconds before the next request.
func TestCurrentQuoteRetriesAFailure(t *testing.T) {
	t.Parallel()

	fake := newCurrentFake(t, false)
	fake.status.Store(http.StatusInternalServerError)

	h := newCurrentHarness(t, usProfile(), fake)
	manual := "AAPL/USD 2026-11-11 173.73 manual"

	h.warm(t, "AAPL")
	h.expect(t, "USD 173.73", []string{manual}, 1)

	h.clock.add(59 * time.Second)
	h.warm(t, "AAPL")
	h.expectRequests(t, 1)

	h.clock.add(time.Second)
	h.warm(t, "AAPL")
	h.expectRequests(t, 2)
}

// CQ10: a source the settings disable is not asked.
func TestCurrentQuoteDisabledSource(t *testing.T) {
	t.Parallel()

	h := newCurrentHarness(t, usProfile(), newCurrentFake(t, false))
	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/yahoo_chart",
		map[string]any{"enabled": false},
		http.StatusOK,
		nil,
	)

	h.warm(t, "AAPL")
	h.expect(t, "USD 173.73", []string{"AAPL/USD 2026-11-11 173.73 manual"}, 0)
}

// CQ14: a read returns at CurrentBound; the request finishes later and the next read uses it.
func TestCurrentQuoteBound(t *testing.T) {
	t.Parallel()

	fake := newCurrentFake(t, true)
	h := newCurrentHarness(t, usProfile(), fake, apitest.CurrentBound(50*time.Millisecond))

	t.Cleanup(fake.release)

	h.warm(t, "AAPL")
	h.expect(t, "USD 173.73", []string{"AAPL/USD 2026-11-11 173.73 manual"}, 1)

	fake.release()
	h.App.Marketdata.WaitRefresh()

	quote := "AAPL/USD 2026-11-12 154.122 yahoo_chart at " + currentFetch + " open"
	h.expect(t, "USD 154.12", []string{quote}, 1)
}

// CQ16: a leg through a currency takes the current quote of the pair, here the inverse one.
func TestCurrentQuoteConvertsThroughACurrency(t *testing.T) {
	t.Parallel()

	h := newCurrentHarness(t, apitest.Brazil(), newCurrentFake(t, false))
	h.recordManual(t, "USD", "BRL", "2026-11-11", "5.50")

	h.warm(t, "AAPL", "BRL")

	got, err := h.App.Marketdata.ConvertCurrent(t.Context(), h.amount(t), "BRL")
	if err != nil {
		t.Fatal(err)
	}

	h.check(t, got, "BRL 891.39", []string{
		"AAPL/USD 2026-11-12 154.122 yahoo_chart at " + currentFetch + " open",
		"BRL/USD 2026-11-12 0.1729 yahoo_chart at " + currentFetch + " open",
	})
	h.expectRequests(t, 1)

	if n := h.fake.count(currentBRL); n != 1 {
		t.Fatalf("requests of %s = %d, want 1", currentBRL, n)
	}
}

type currentHarness struct {
	*apitest.Harness

	clock *currentClock
	fake  *currentFake
}

func newCurrentHarness(
	t *testing.T,
	profile apitest.Profile,
	fake *currentFake,
	opts ...apitest.Option,
) *currentHarness {
	t.Helper()

	clock := &currentClock{now: time.Date(2026, 11, 12, 15, 13, 0, 0, time.UTC)}
	opts = append([]apitest.Option{
		apitest.As(profile),
		apitest.Clock(clock.Now),
		apitest.PriceFeeds(
			[]string{"yahoo_chart"},
			map[string]string{"yahoo_chart": fake.srv.URL + "/yahoo"},
		),
	}, opts...)

	h := &currentHarness{Harness: apitest.New(t, opts...), clock: clock, fake: fake}

	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "AAPL", "type": "stock", "scale": 0, "name": "Apple",
		"quote_currency": "USD", "exchange": "XNAS",
	}, http.StatusCreated, nil)
	h.recordManual(t, "AAPL", "USD", "2026-11-11", "173.73")

	return h
}

func (h *currentHarness) recordManual(t *testing.T, instrument, quote, date, value string) {
	t.Helper()

	h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument": instrument, "quote_instrument": quote, "date": date, "value": value,
	}, http.StatusCreated, nil)
}

func (h *currentHarness) warm(t *testing.T, codes ...money.Currency) {
	t.Helper()

	h.App.Marketdata.WarmCurrent(t.Context(), codes)
}

func (h *currentHarness) amount(t *testing.T) money.Money {
	t.Helper()

	q, err := money.NewOf(1, "AAPL", 0)
	if err != nil {
		t.Fatal(err)
	}

	return q
}

// expect values 1 AAPL in USD at the current quote and checks the requests to Yahoo.
func (h *currentHarness) expect(t *testing.T, value string, prices []string, requests int) {
	t.Helper()

	got, err := h.App.Marketdata.ConvertCurrent(t.Context(), h.amount(t), "USD")
	if err != nil {
		t.Fatal(err)
	}

	h.check(t, got, value, prices)
	h.expectRequests(t, requests)
}

func (h *currentHarness) check(
	t *testing.T,
	got marketdata.Conversion,
	value string,
	prices []string,
) {
	t.Helper()

	if got.Value.String() != value {
		t.Fatalf("value = %s, want %s", got.Value, value)
	}

	lines := make([]string, len(got.Prices))
	for i, p := range got.Prices {
		lines[i] = priceLine(p)
	}

	if !slices.Equal(lines, prices) {
		t.Fatalf("prices = %q, want %q", lines, prices)
	}
}

func (h *currentHarness) expectRequests(t *testing.T, want int) {
	t.Helper()

	if n := h.fake.count(currentAAPL); n != want {
		t.Fatalf("requests of %s = %d, want %d", currentAAPL, n, want)
	}
}

func priceLine(p marketdata.Price) string {
	line := fmt.Sprintf(
		"%s/%s %s %s %s",
		p.Instrument, p.Quote, p.Date.Format(time.DateOnly), p.Value, p.Source,
	)
	if p.At == nil {
		return line
	}

	line += " at " + p.At.Format(time.RFC3339)
	if p.Open {
		line += " open"
	}

	return line
}

// currentClock is the instance clock; the sources read it from goroutines.
type currentClock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *currentClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.now
}

func (c *currentClock) add(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.now = c.now.Add(d)
}

// currentFake serves Yahoo: an open session for AAPL, the currency chart for BRLUSD=X. A status
// other than zero answers every request with it; a fake built blocking waits for release.
type currentFake struct {
	srv    *httptest.Server
	status atomic.Int32

	block chan struct{}
	once  sync.Once

	mu    sync.Mutex
	paths []string
}

func newCurrentFake(t *testing.T, blocking bool) *currentFake {
	t.Helper()

	f := &currentFake{}
	if blocking {
		f.block = make(chan struct{})
	}

	f.srv = httptest.NewServer(http.HandlerFunc(f.serve))
	t.Cleanup(f.srv.Close)

	return f
}

func (f *currentFake) serve(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	f.paths = append(f.paths, r.URL.Path)
	f.mu.Unlock()

	if f.block != nil {
		select {
		case <-f.block:
		case <-r.Context().Done():
			return
		}
	}

	if code := f.status.Load(); code != 0 {
		w.WriteHeader(int(code))
		return
	}

	switch r.URL.Path {
	case currentAAPL:
		_, _ = w.Write([]byte(currentBody("USD", "America/New_York", "154.122", 1794496320)))
	case currentBRL:
		_, _ = w.Write([]byte(currentBody("USD", "Europe/London", "0.1729", 1794496320)))
	default:
		http.NotFound(w, r)
	}
}

func (f *currentFake) release() {
	if f.block != nil {
		f.once.Do(func() { close(f.block) })
	}
}

func (f *currentFake) count(path string) int {
	f.mu.Lock()
	defer f.mu.Unlock()

	n := 0

	for _, p := range f.paths {
		if p == path {
			n++
		}
	}

	return n
}

// currentBody is an answer with the regular session of 2026-11-12 in New York (14:30 to 21:00
// UTC) for a zone other than London, and the whole day for London.
func currentBody(currency, zone, price string, last int64) string {
	start, end := int64(1794493800), int64(1794517200)
	if zone == "Europe/London" {
		start, end = 1794441600, 1794527940
	}

	return fmt.Sprintf(
		`{"chart":{"result":[{"meta":{"currency":"%s","exchangeTimezoneName":"%s",`+
			`"regularMarketPrice":%s,"regularMarketTime":%d,`+
			`"currentTradingPeriod":{"regular":{"start":%d,"end":%d}}},`+
			`"timestamp":[],"indicators":{"quote":[{}]}}]}}`,
		currency, zone, price, last, start, end,
	)
}
