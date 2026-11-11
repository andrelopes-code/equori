package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type probeQuoteAPI struct {
	Source string  `json:"source"`
	Date   *string `json:"date"`
	Value  *string `json:"value"`
	Error  *string `json:"error"`
}

type probeAPI struct {
	Quotes    []probeQuoteAPI `json:"quotes"`
	Available []string        `json:"available"`
}

const probePath = "/api/v1/market-data/probe"

// S366: a probe shows what each source quotes for an instrument not yet defined and stores
// nothing (MQ27).
func TestS366Probe(t *testing.T) {
	t.Parallel()

	h := probeHarness(t, []string{"yahoo_chart"}, 0)

	var got probeAPI

	h.MustDo(http.MethodPost, probePath, probeBody(nil), http.StatusOK, &got)

	date, value := "2026-11-06", "132.25"
	want := probeAPI{
		Quotes:    []probeQuoteAPI{{Source: "yahoo_chart", Date: &date, Value: &value}},
		Available: []string{},
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("probe = %+v, want %+v", got, want)
	}

	h.ExpectProblem(h.Call(h.Client, http.MethodGet, "/api/v1/instruments/VWCE", nil),
		http.StatusNotFound, "not_found", "")

	if rows := h.Rows("SELECT count(*) FROM marketdata_price WHERE instrument = 'VWCE'"); !reflect.DeepEqual(rows, []string{"0"}) {
		t.Fatalf("stored prices = %v, want [0]", rows)
	}

	off := probeHarness(t, nil, 0)

	off.MustDo(http.MethodPost, probePath, probeBody(nil), http.StatusOK, &got)

	if want := (probeAPI{Quotes: []probeQuoteAPI{}, Available: []string{"yahoo_chart"}}); !reflect.DeepEqual(got, want) {
		t.Fatalf("disabled probe = %+v, want %+v", got, want)
	}

	h.MustDo(http.MethodPost, probePath, probeBody(map[string]any{"quote_currency": "USD"}), http.StatusOK, &got)

	msg := "instrument VWCE: quoted in EUR, want USD"
	want = probeAPI{
		Quotes:    []probeQuoteAPI{{Source: "yahoo_chart", Error: &msg}},
		Available: []string{},
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("other currency probe = %+v, want %+v", got, want)
	}

	expectProbeRejected(t, h)
}

// S366: a source past ProbeBound answers with its error, not with a failed request (MQ27).
func TestProbeBound(t *testing.T) {
	t.Parallel()

	h := probeHarness(t, []string{"yahoo_chart"}, time.Millisecond)

	var got probeAPI

	h.MustDo(http.MethodPost, probePath, probeBody(nil), http.StatusOK, &got)

	if len(got.Quotes) != 1 || got.Quotes[0].Date != nil || got.Quotes[0].Error == nil {
		t.Fatalf("probe = %+v, want one item without a date and with an error", got)
	}
}

// A223 B2: a probe reads the sources for a person who can write.
func TestProbeRoles(t *testing.T) {
	t.Parallel()

	h := probeHarness(t, []string{"yahoo_chart"}, 0)

	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")
	h.ExpectProblem(h.Call(reader, http.MethodPost, probePath, probeBody(nil)),
		http.StatusForbidden, "book_role_required", "")

	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")
	if r := h.Call(writer, http.MethodPost, probePath, probeBody(nil)); r.Status != http.StatusOK {
		t.Fatalf("writer status = %d: %s", r.Status, r.Body)
	}

	h.ExpectProblem(h.Call(&http.Client{}, http.MethodPost, probePath, probeBody(nil)),
		http.StatusUnauthorized, "unauthenticated", "")
}

// S366: an input that cannot name a security is rejected before any source is read (MQ27).
func expectProbeRejected(t *testing.T, h *apitest.Harness) {
	t.Helper()

	tests := []struct {
		name   string
		change map[string]any
		status int
		code   string
		field  string
	}{
		{"currency type", map[string]any{"type": "currency"}, 422, "validation_failed", "type"},
		{"quote is no currency", map[string]any{"quote_currency": "VWCE"}, 422, "validation_failed", "quote_currency"},
		{
			"symbol of a source without overrides", map[string]any{"symbols": map[string]string{"ecb": "X"}},
			422, "validation_failed", "symbols.ecb",
		},
		{"lower case code", map[string]any{"code": "vwce"}, 400, "invalid_request", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h.ExpectProblem(h.Call(h.Client, http.MethodPost, probePath, probeBody(tt.change)),
				tt.status, tt.code, tt.field)
		})
	}
}

// probeHarness enables the sources of enabled against a Yahoo fake serving vwce.json under
// /yahoo/. A non-zero bound sets ProbeBound and makes the fake wait for the request to end.
func probeHarness(t *testing.T, enabled []string, bound time.Duration) *apitest.Harness {
	t.Helper()

	body, err := os.ReadFile("internal/feed/yahoochart/testdata/vwce.json")
	if err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/yahoo/") {
			http.NotFound(w, r)
			return
		}

		if bound != 0 {
			<-r.Context().Done()
			return
		}

		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)

	opts := []apitest.Option{
		apitest.Today("2026-11-09"),
		apitest.PriceFeeds(enabled, map[string]string{"yahoo_chart": srv.URL + "/yahoo"}),
	}
	if bound != 0 {
		opts = append(opts, apitest.FeedBounds(time.Second, bound))
	}

	return apitest.New(t, opts...)
}

// probeBody is the request of S366 with the fields of change replaced.
func probeBody(change map[string]any) map[string]any {
	body := map[string]any{"code": "VWCE", "type": "etf", "exchange": "XETR", "quote_currency": "EUR"}
	for k, v := range change {
		body[k] = v
	}

	return body
}
