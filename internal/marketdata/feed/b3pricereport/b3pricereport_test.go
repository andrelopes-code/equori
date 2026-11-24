package b3pricereport_test

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/b3pricereport"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}

// priced is one report of a file; an empty last price is a security without a trade.
type priced struct{ ticker, last string }

// report is a file of the B3: one business group per security.
func report(date string, rows ...priced) []byte {
	var b strings.Builder

	b.WriteString(`<?xml version="1.0" encoding="utf-8"?><Document>`)

	for _, r := range rows {
		last := ""
		if r.last != "" {
			last = `<LastPric Ccy="BRL">` + r.last + `</LastPric>`
		}

		fmt.Fprintf(&b, `<BizGrp><PricRpt><TradDt><Dt>%s</Dt></TradDt><SctyId>
			<TckrSymb>%s</TckrSymb></SctyId><FinInstrmAttrbts>%s</FinInstrmAttrbts></PricRpt></BizGrp>`,
			date, r.ticker, last)
	}

	b.WriteString(`</Document>`)

	return []byte(b.String())
}

// archive compresses files by name.
func archive(t *testing.T, files map[string][]byte) []byte {
	t.Helper()

	var buf bytes.Buffer

	zw := zip.NewWriter(&buf)

	for name, body := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}

		if _, err := w.Write(body); err != nil {
			t.Fatal(err)
		}
	}

	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}

	return buf.Bytes()
}

// server answers the files by name, "SPRE220610", and an empty archive for any other, as the B3 does
// for a day without a session.
type server struct {
	mu    sync.Mutex
	files map[string][]byte
	asked []string
	empty []byte
}

func (s *server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSuffix(r.URL.Query().Get("filelist"), ".zip,")

	s.mu.Lock()
	s.asked = append(s.asked, name)
	s.mu.Unlock()

	if body, ok := s.files[name]; ok {
		_, _ = w.Write(body)
		return
	}

	_, _ = w.Write(s.empty)
}

func start(t *testing.T, files map[string][]byte) (*server, b3pricereport.Source) {
	t.Helper()

	s := &server{files: files, empty: archive(t, nil)}
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)

	return s, b3pricereport.New(srv.Client(), srv.URL)
}

func shape(quotes []feed.Quote) []string {
	out := make([]string, len(quotes))
	for i, q := range quotes {
		out[i] = fmt.Sprintf("%s %s %s %s",
			q.Date.Format(time.DateOnly), q.Instrument, q.Quote, q.Value)
	}

	return out
}

// The last price of each code of the simplified report, the last file of the archive; a security
// without a trade and another code give nothing, and a day without a file is skipped.
func TestFetch(t *testing.T) {
	t.Parallel()

	s, src := start(t, map[string][]byte{
		"SPRE220610": archive(t, map[string][]byte{"SPRE220610.zip": archive(t, map[string][]byte{
			"BVBG_1.xml": report("2022-06-10", priced{"IMAB11", "83"}),
			"BVBG_2.xml": report("2022-06-10",
				priced{"IMAB11", "84"}, priced{"B5P211", "75.05"}, priced{"IMAB11F", "1"},
				priced{"PETR4", ""}, priced{"VALE3", "60"}),
		})}),
		"SPRE220614": archive(t, map[string][]byte{"SPRE220614.zip": archive(t, map[string][]byte{
			"BVBG_1.xml": report("2022-06-14", priced{"IMAB11", "83.6"}),
		})}),
	})

	got, err := src.Fetch(
		t.Context(),
		[]money.Currency{"IMAB11", "B5P211", "PETR4"},
		day("2022-06-10"),
		day("2022-06-14"),
	)
	if err != nil {
		t.Fatal(err)
	}

	want := []string{
		"2022-06-10 IMAB11 BRL 84", "2022-06-10 B5P211 BRL 75.05", "2022-06-14 IMAB11 BRL 83.6",
	}
	if !slices.Equal(shape(got), want) {
		t.Errorf("quotes = %v, want %v", shape(got), want)
	}

	if !slices.Equal(s.asked, []string{"SPRE220610", "SPRE220613", "SPRE220614"}) {
		t.Errorf("asked = %v, want the three weekdays and no full report", s.asked)
	}
}

// Before the simplified report, the full one is read: three revisions, the last one counts.
func TestFetchReadsTheFullReportOfAnOldDay(t *testing.T) {
	t.Parallel()

	s, src := start(t, map[string][]byte{
		"PR190610": archive(t, map[string][]byte{"PR190610.zip": archive(t, map[string][]byte{
			"BVBG_3.xml": report("2019-06-10", priced{"IMAB11", "70.8"}),
			"BVBG_1.xml": report("2019-06-10", priced{"IMAB11", "70"}),
			"BVBG_2.xml": report("2019-06-10", priced{"IMAB11", "70.5"}),
		})}),
	})

	got, err := src.Fetch(
		t.Context(),
		[]money.Currency{"IMAB11"},
		day("2019-06-10"),
		day("2019-06-10"),
	)
	if err != nil || !slices.Equal(shape(got), []string{"2019-06-10 IMAB11 BRL 70.8"}) {
		t.Errorf("quotes = %v, %v", shape(got), err)
	}

	if !slices.Equal(s.asked, []string{"SPRE190610", "PR190610"}) {
		t.Errorf("asked = %v", s.asked)
	}
}

// A long range reads its last 31 days: the holes before them are asked day by day.
func TestFetchOfALongRangeReadsItsLastDays(t *testing.T) {
	t.Parallel()

	s, src := start(t, nil)

	if _, err := src.Fetch(
		t.Context(),
		[]money.Currency{"IMAB11"},
		day("2006-01-01"),
		day("2026-11-20"),
	); err != nil {
		t.Fatal(err)
	}

	if len(s.asked) != 24 || s.asked[0] != "SPRE261020" {
		t.Errorf("asked = %d files from %s, want 24 from SPRE261020", len(s.asked), s.asked[0])
	}
}

func TestFetchRefusesAMalformedFile(t *testing.T) {
	t.Parallel()

	for name, body := range map[string][]byte{
		"not a ZIP":     []byte("<html>busy</html>"),
		"another day":   archive(t, map[string][]byte{"a.zip": archive(t, map[string][]byte{"a.xml": report("2026-11-19", priced{"IMAB11", "1"})})}),
		"no report":     archive(t, map[string][]byte{"a.zip": archive(t, map[string][]byte{"a.xml": []byte("<Document/>")})}),
		"not a decimal": archive(t, map[string][]byte{"a.zip": archive(t, map[string][]byte{"a.xml": report("2026-11-20", priced{"IMAB11", "x"})})}),
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			_, src := start(t, map[string][]byte{"SPRE261120": body})

			got, err := src.Fetch(
				t.Context(),
				[]money.Currency{"IMAB11"},
				day("2026-11-20"),
				day("2026-11-20"),
			)

			var scope *feed.ScopeError
			if !errors.As(err, &scope) || scope.Value != "2026-11-20" || len(got) != 0 {
				t.Errorf("quotes = %v, error = %v, want a failure of the day", got, err)
			}
		})
	}
}

func TestCodes(t *testing.T) {
	t.Parallel()

	got := b3pricereport.New(nil, "").Codes([]feed.Instrument{
		{Code: "IMAB11", Type: "etf", Exchange: "BVMF", QuoteCurrency: "BRL"},
		{Code: "AAPL", Type: "stock", Exchange: "XNAS", QuoteCurrency: "USD"},
		{Code: "USD", Type: "currency"},
	})
	if !slices.Equal(got, []money.Currency{"IMAB11"}) {
		t.Errorf("codes = %v", got)
	}
}
