package b3consolidated_test

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed/b3consolidated"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

// b3Server answers the two steps of a download: a token per date, then the file of that token.
// A date without a file answers 400, as the B3 does for a weekend, a holiday or a day not yet
// published.
type b3Server struct {
	files map[string][]byte
	mu    sync.Mutex
	dates []string
}

func (s *b3Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	switch r.URL.Path {
	case "/api/download/requestname":
		date := q.Get("date")
		s.mu.Lock()
		s.dates = append(s.dates, date)
		s.mu.Unlock()
		if q.Get("fileName") != "TradeInformationConsolidatedFile" {
			http.Error(w, "unknown file", http.StatusBadRequest)
			return
		}
		if _, ok := s.files[date]; !ok {
			http.Error(w, "no file", http.StatusBadRequest)
			return
		}
		_, _ = w.Write([]byte(`{"redirectUrl":"~/download?token=t` + date + `","token":"t` + date + `","file":{}}`))
	case "/api/download/":
		file, ok := s.files[strings.TrimPrefix(q.Get("token"), "t")]
		if !ok {
			http.Error(w, "bad token", http.StatusBadRequest)
			return
		}
		_, _ = w.Write(file)
	default:
		http.NotFound(w, r)
	}
}

func fixture(t *testing.T) []byte {
	t.Helper()
	b, err := os.ReadFile("testdata/2026-10-27.csv")
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func serve(t *testing.T, files map[string][]byte) (*b3Server, b3consolidated.Source) {
	t.Helper()
	s := &b3Server{files: files}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	return s, b3consolidated.New(srv.Client(), srv.URL)
}

// AUPO11, a fixed income ETF, sits in segment FORWARD; IVVB11 in CASH. An untraded option has no
// last price, and an odd lot or block trade has its own ticker.
func TestFetch(t *testing.T) {
	t.Parallel()
	_, src := serve(t, map[string][]byte{"2026-10-27": fixture(t)})
	got, err := src.Fetch(t.Context(), []money.Currency{"AUPO11", "IVVB11", "PETR4", "A1MDA315", "WEGE3"}, day("2026-10-27"), day("2026-10-27"))
	if err != nil {
		t.Fatal(err)
	}
	want := map[money.Currency]string{"AUPO11": "111.31", "IVVB11": "466.16", "PETR4": "52.79"}
	if len(got) != len(want) {
		t.Fatalf("quotes %+v", got)
	}
	for _, q := range got {
		if want[q.Instrument] != q.Value.String() || q.Quote != "BRL" || !q.Date.Equal(day("2026-10-27")) {
			t.Fatalf("quote %+v", q)
		}
	}
}

func TestFetchSkipsWeekendsAndDaysWithoutFile(t *testing.T) {
	t.Parallel()
	friday := strings.ReplaceAll(string(fixture(t)), "2026-10-27;", "2026-10-23;")
	s, src := serve(t, map[string][]byte{"2026-10-23": []byte(friday), "2026-10-27": fixture(t)})
	got, err := src.Fetch(t.Context(), []money.Currency{"AUPO11"}, day("2026-10-23"), day("2026-10-28"))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || !got[0].Date.Equal(day("2026-10-23")) || !got[1].Date.Equal(day("2026-10-27")) {
		t.Fatalf("quotes %+v", got)
	}
	if want := []string{"2026-10-23", "2026-10-26", "2026-10-27", "2026-10-28"}; !slices.Equal(s.dates, want) {
		t.Fatalf("dates %v, want %v", s.dates, want)
	}
}

// A file not yet final ends the run without a failure: the next tick fetches its day again.
func TestFetchStopsAtAFileNotFinal(t *testing.T) {
	t.Parallel()
	partial := strings.Replace(strings.ReplaceAll(string(fixture(t)), "2026-10-27;", "2026-10-28;"), "Final", "Parcial", 1)
	s, src := serve(t, map[string][]byte{"2026-10-27": fixture(t), "2026-10-28": []byte(partial), "2026-10-29": fixture(t)})
	got, err := src.Fetch(t.Context(), []money.Currency{"AUPO11"}, day("2026-10-27"), day("2026-10-29"))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || !got[0].Date.Equal(day("2026-10-27")) || !slices.Equal(s.dates, []string{"2026-10-27", "2026-10-28"}) {
		t.Fatalf("quotes %+v, dates %v", got, s.dates)
	}
}

func TestFetchRejectsMalformedFiles(t *testing.T) {
	t.Parallel()
	good := string(fixture(t))
	aupo := "2026-10-27;AUPO11;BRAUPOCTF005;FORWARD;111,02;111,77;111,21;111,31;0,02;;;;4312;244390;26950806,21"
	tests := map[string]string{
		"no status":      strings.Replace(good, "Status do Arquivo: Final\n", "", 1),
		"no last price":  strings.Replace(good, "LastPric", "Last", 1),
		"short line":     strings.Replace(good, aupo, aupo[:60], 1),
		"other date":     strings.Replace(good, aupo, strings.Replace(aupo, "2026-10-27", "2026-10-26", 1), 1),
		"bad price":      strings.Replace(good, aupo, strings.Replace(aupo, ";111,31;", ";111,3X;", 1), 1),
		"zero price":     strings.Replace(good, aupo, strings.Replace(aupo, ";111,31;", ";0;", 1), 1),
		"repeated code":  good + aupo + "\n",
		"empty response": "",
	}
	for name, file := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			_, src := serve(t, map[string][]byte{"2026-10-27": []byte(file)})
			got, err := src.Fetch(t.Context(), []money.Currency{"AUPO11"}, day("2026-10-27"), day("2026-10-27"))
			var scope *feed.ScopeError
			if !errors.As(err, &scope) || scope.Key != "day" || scope.Value != "2026-10-27" || got != nil {
				t.Fatalf("got %+v, %v", got, err)
			}
		})
	}
}

// A failing day ends the run and keeps the quotes of the earlier days.
func TestFetchKeepsEarlierDays(t *testing.T) {
	t.Parallel()
	var dates []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		date := r.URL.Query().Get("date")
		switch {
		case r.URL.Path == "/api/download/requestname" && date == "2026-10-27":
			dates = append(dates, date)
			_, _ = w.Write([]byte(`{"token":"t"}`))
		case r.URL.Path == "/api/download/":
			_, _ = w.Write(fixture(t))
		case r.URL.Path == "/api/download/requestname" && date == "2026-10-28":
			dates = append(dates, date)
			_, _ = w.Write([]byte(`{"token":""}`))
		default:
			dates = append(dates, date)
			http.Error(w, "busy", http.StatusInternalServerError)
		}
	}))
	t.Cleanup(srv.Close)
	got, err := b3consolidated.New(srv.Client(), srv.URL).Fetch(t.Context(), []money.Currency{"AUPO11"}, day("2026-10-27"), day("2026-10-29"))
	var scope *feed.ScopeError
	if !errors.As(err, &scope) || scope.Value != "2026-10-28" || errors.Is(err, feed.ErrNoData) {
		t.Fatalf("err = %v", err)
	}
	if len(got) != 1 || got[0].Instrument != "AUPO11" || !slices.Equal(dates, []string{"2026-10-27", "2026-10-28"}) {
		t.Fatalf("quotes %+v, dates %v", got, dates)
	}
}

func TestFetchFailsOnAServerError(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "busy", http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)
	_, err := b3consolidated.New(srv.Client(), srv.URL).Fetch(t.Context(), []money.Currency{"AUPO11"}, day("2026-10-27"), day("2026-10-27"))
	if err == nil || errors.Is(err, feed.ErrNoData) {
		t.Fatalf("err = %v", err)
	}
}

func TestCodes(t *testing.T) {
	t.Parallel()
	ins := []feed.Instrument{
		{Code: "AUPO11", Type: "etf", Exchange: "BVMF", QuoteCurrency: "BRL"},
		{Code: "AAPL", Type: "stock", Exchange: "XNAS", QuoteCurrency: "USD"},
		{Code: "PETR4", Type: "stock", QuoteCurrency: "BRL"},
		{Code: "USD", Type: "currency"},
	}
	got := b3consolidated.Source{}.Codes(ins)
	if len(got) != 1 || got[0] != "AUPO11" {
		t.Fatalf("codes = %v", got)
	}
}
