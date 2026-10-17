package marketdata_test

import (
	"archive/zip"
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// feedServer answers PTAX under /ptax and COTAHIST under /b3, recording each request.
type feedServer struct {
	mu       sync.Mutex
	requests []string
	failDay  string // a COTAHIST day answered with 500 while set
	failPTAX string // a currency answered with 500 while set
}

func (f *feedServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	f.requests = append(f.requests, r.URL.RequestURI())
	failDay, failPTAX := f.failDay, f.failPTAX
	f.mu.Unlock()
	switch {
	case strings.HasPrefix(r.URL.Path, "/ptax/"):
		code := strings.Trim(r.URL.Query().Get("@moeda"), "'")
		switch code {
		case "ARS":
			http.NotFound(w, r)
		case failPTAX:
			http.Error(w, "busy", http.StatusServiceUnavailable)
		case "USD":
			_, _ = w.Write([]byte(`{"value":[
{"cotacaoVenda":5.49500,"dataHoraCotacao":"2026-10-29 13:09:28.211","tipoBoletim":"Fechamento"},
{"cotacaoVenda":5.40000,"dataHoraCotacao":"2026-10-30 10:09:28.211","tipoBoletim":"Abertura"},
{"cotacaoVenda":5.49900,"dataHoraCotacao":"2026-10-30 13:09:28.211","tipoBoletim":"Fechamento"}]}`))
		default:
			_, _ = w.Write([]byte(`{"value":[]}`))
		}
	case r.URL.Path == "/b3/COTAHIST_D"+failDay+".ZIP":
		http.Error(w, "busy", http.StatusInternalServerError)
	case r.URL.Path == "/b3/COTAHIST_D29102026.ZIP":
		_, _ = w.Write(dailyFile("20261029", "MXRF11", 936))
	case r.URL.Path == "/b3/COTAHIST_D30102026.ZIP":
		_, _ = w.Write(dailyFile("20261030", "MXRF11", 940))
	default:
		http.NotFound(w, r)
	}
}

func (f *feedServer) take() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := f.requests
	f.requests = nil
	return out
}

func dailyFile(date, ticker string, close int64) []byte {
	rec := fmt.Sprintf("01%s02%-12s010%-12s%-10s%-3s%-4s", date, ticker, "NAME", "CI", "", "R$")
	rec += fmt.Sprintf("%013d%013d%013d%013d%013d", close, close, close, close, close)
	rec += strings.Repeat("0", 245-len(rec))
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, _ := zw.Create("COTAHIST.TXT")
	_, _ = w.Write([]byte(rec + "\r\n"))
	_ = zw.Close()
	return buf.Bytes()
}

func pricesOf(t *testing.T, h *apitest.Harness, instrument string) []priceAPI {
	t.Helper()
	var list struct {
		Items []priceAPI `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/prices?instrument="+instrument+"&quote_instrument=BRL&from=2026-09-01&to=2026-11-30", nil, http.StatusOK, &list)
	return list.Items
}

// N17: with no feed named, a tick sends no request.
func TestFeedsDisabledSendNoRequest(t *testing.T) {
	f := &feedServer{}
	srv := httptest.NewServer(f)
	t.Cleanup(srv.Close)
	h := apitest.New(t, apitest.Today("2026-11-01"), apitest.PriceFeeds(false, false, srv.URL+"/ptax", srv.URL+"/b3"))
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	h.App.Marketdata.TickFeeds(t.Context())
	if got := f.take(); len(got) != 0 {
		t.Fatalf("requests = %v", got)
	}
}

// P8 amendment A62 and Review Focus 4.
func TestFeedsFetchPrices(t *testing.T) {
	f := &feedServer{failDay: "30102026", failPTAX: "EUR"}
	srv := httptest.NewServer(f)
	t.Cleanup(srv.Close)
	h := apitest.New(t, apitest.Today("2026-11-01"), apitest.PriceFeeds(true, true, srv.URL+"/ptax", srv.URL+"/b3"))
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "USD", "quote_instrument": "BRL", "date": "2026-10-30", "value": "5.6"}, http.StatusCreated, nil)

	h.App.Marketdata.TickFeeds(t.Context())
	first := f.take()
	b3 := filter(first, "/b3/")
	if len(b3) != 21 || b3[0] != "/b3/COTAHIST_D02102026.ZIP" || b3[20] != "/b3/COTAHIST_D30102026.ZIP" {
		t.Fatalf("first tick B3 requests = %v", b3)
	}
	// A 404 (ARS) and a 503 (EUR) end only their currency's run; USD is still fetched.
	ptax := filter(first, "/ptax/")
	if len(ptax) != 14 || !strings.Contains(ptax[0], "@moeda='ARS'&@dataInicial='10-02-2026'&@dataFinalCotacao='11-01-2026'") || !strings.Contains(ptax[7], "'EUR'") {
		t.Fatalf("first tick PTAX requests = %v", ptax)
	}
	if got := pricesOf(t, h, "MXRF11"); len(got) != 1 || got[0] != (priceAPI{Instrument: "MXRF11", QuoteInstrument: "BRL", Date: "2026-10-29", Value: "9.36", Source: "b3_cotahist"}) {
		t.Fatalf("MXRF11 after the first tick = %+v", got)
	}
	usd := pricesOf(t, h, "USD")
	if len(usd) != 2 || usd[0] != (priceAPI{Instrument: "USD", QuoteInstrument: "BRL", Date: "2026-10-29", Value: "5.495", Source: "bcb_ptax"}) ||
		usd[1].Value != "5.6" || usd[1].Source != "manual" {
		t.Fatalf("USD after the first tick = %+v", usd)
	}
	logs := h.Logs()
	if !strings.Contains(logs, "source=b3_cotahist") || !strings.Contains(logs, "day=2026-10-30") || !strings.Contains(logs, "source=bcb_ptax") ||
		!strings.Contains(logs, "instrument=EUR") || strings.Contains(logs, "instrument=ARS") {
		t.Fatalf("logs = %s", logs)
	}

	f.mu.Lock()
	f.failDay, f.failPTAX = "", ""
	f.mu.Unlock()
	h.App.Marketdata.TickFeeds(t.Context())
	second := f.take()
	if b3 := filter(second, "/b3/"); len(b3) != 1 || b3[0] != "/b3/COTAHIST_D30102026.ZIP" {
		t.Fatalf("second tick B3 requests = %v", b3)
	}
	ptax = filter(second, "/ptax/")
	if len(ptax) != 14 || !strings.Contains(ptax[12], "@moeda='USD'&@dataInicial='10-31-2026'") ||
		!strings.Contains(ptax[0], "@moeda='ARS'&@dataInicial='10-02-2026'") || !strings.Contains(ptax[7], "@moeda='EUR'&@dataInicial='10-02-2026'") {
		t.Fatalf("second tick PTAX requests = %v", ptax)
	}
	if got := pricesOf(t, h, "MXRF11"); len(got) != 2 || got[1].Value != "9.4" {
		t.Fatalf("MXRF11 after the second tick = %+v", got)
	}
}

func filter(rs []string, prefix string) []string {
	var out []string
	for _, r := range rs {
		if strings.HasPrefix(r, prefix) {
			out = append(out, r)
		}
	}
	return out
}
