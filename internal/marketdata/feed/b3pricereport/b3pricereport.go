// Package b3pricereport reads the price report the B3 publishes for each session: every security of
// every segment, the fixed income ETFs that COTAHIST omits included.
package b3pricereport

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	path = "/pesquisapregao/download?filelist="
	// windowDays is how far back of its end a range is read.
	windowDays = 31
	// maxInnerBytes bounds the compressed report inside the archive, about 7 MB for the full one.
	maxInnerBytes = 64 << 20
	// maxReportBytes bounds one security of a report; one takes about 2 KB.
	maxReportBytes = 1 << 20
)

var (
	// since is the earliest session whose full report was read (2026-11-24).
	since = time.Date(2018, time.June, 12, 0, 0, 0, 0, time.UTC)
	// simplified is the day from which the simplified report alone is read: it was published for
	// 2022-01-10 and not for 2021-11-10.
	simplified = time.Date(2022, time.February, 1, 0, 0, 0, 0, time.UTC)

	endOfReport = []byte("</PricRpt>")
)

// Source reads the price reports.
type Source struct {
	client  *http.Client
	baseURL string
}

func New(c *http.Client, baseURL string) Source {
	return Source{client: c, baseURL: strings.TrimSuffix(baseURL, "/")}
}

func (Source) ID() string { return "b3_price_report" }

// DayArchiveSince is the first day the B3 keeps a report of (feed.DayArchive).
func (Source) DayArchiveSince() time.Time { return since }

// Witness is a code that traded at every session since 2006-11-24 (feed.Witnessed): the report lists
// every security of the exchange.
func (Source) Witness() money.Currency { return "PETR4" }

// Codes returns the instruments listed on the B3 and quoted in BRL.
func (Source) Codes(ins []feed.Instrument) []money.Currency {
	var out []money.Currency

	for _, in := range ins {
		if in.Exchange == "BVMF" && in.QuoteCurrency == "BRL" {
			out = append(out, in.Code)
		}
	}

	return out
}

// Fetch returns the last trade price (in BRL) of each code for each weekday of [from, to], one file
// per day. A range over 31 days reads its last 31: the check of the holes asks for the days before
// them (A265 PH4). A day without a file is skipped; the first failing one ends the run, and its
// failure, a feed.ScopeError, is returned with the quotes of the earlier days.
func (s Source) Fetch(
	ctx context.Context,
	codes []money.Currency,
	from, to time.Time,
) ([]feed.Quote, error) {
	if first := to.AddDate(0, 0, -windowDays); from.Before(first) {
		from = first
	}

	want := make(map[string]bool, len(codes))
	for _, code := range codes {
		want[string(code)] = true
	}

	var out []feed.Quote

	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
			continue
		}

		quotes, err := s.fetchDay(ctx, d, want)
		if errors.Is(err, feed.ErrNoData) {
			continue
		}

		if err != nil {
			return out, &feed.ScopeError{Key: "day", Value: d.Format(time.DateOnly), Err: err}
		}

		out = append(out, quotes...)
	}

	return out, nil
}

// fetchDay reads the simplified report of day, or the full one for a day before it existed.
func (s Source) fetchDay(
	ctx context.Context,
	day time.Time,
	want map[string]bool,
) ([]feed.Quote, error) {
	quotes, err := s.fetchReport(ctx, "SPRE", day, want)
	if errors.Is(err, feed.ErrNoData) && day.Before(simplified) {
		return s.fetchReport(ctx, "PR", day, want)
	}

	return quotes, err
}

func (s Source) fetchReport(
	ctx context.Context,
	kind string,
	day time.Time,
	want map[string]bool,
) ([]feed.Quote, error) {
	body, err := feed.Get(ctx, s.client, s.baseURL+path+kind+day.Format("060102")+".zip,")
	if err != nil {
		return nil, err
	}

	report, err := lastReport(body)
	if err != nil {
		return nil, err
	}

	defer func() { _ = report.Close() }()

	return scan(report, day, want)
}

// lastReport opens the last revision of the report: the archive holds one archive of files whose
// names sort by the time of their publication. An archive without a file is a day without a session.
func lastReport(body []byte) (io.ReadCloser, error) {
	outer, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		return nil, fmt.Errorf("open the archive: %w", err)
	}

	if len(outer.File) == 0 {
		return nil, feed.ErrNoData
	}

	f, err := outer.File[0].Open()
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", outer.File[0].Name, err)
	}

	defer func() { _ = f.Close() }()

	data, err := io.ReadAll(io.LimitReader(f, maxInnerBytes))
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", outer.File[0].Name, err)
	}

	inner, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", outer.File[0].Name, err)
	}

	if len(inner.File) == 0 {
		return nil, feed.ErrNoData
	}

	last := slices.MaxFunc(inner.File, func(a, b *zip.File) int {
		return strings.Compare(a.Name, b.Name)
	})

	return last.Open()
}

// scan reads the securities of a report and returns the last price of the wanted ones. A security of
// another day is left out, as a few files hold some; a report without one of the day is malformed.
func scan(r io.Reader, day time.Time, want map[string]bool) ([]feed.Quote, error) {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 64<<10), maxReportBytes)
	sc.Split(splitReports)

	var (
		out  []feed.Quote
		read bool
	)

	for sc.Scan() {
		security := sc.Bytes()

		ticker, ok := element(security, "TckrSymb")
		if !ok {
			continue
		}

		if date, _ := element(security, "Dt"); date != day.Format(time.DateOnly) {
			continue
		}

		read = true

		last, ok := element(security, "LastPric")
		if !ok || !want[ticker] {
			continue
		}

		value, err := money.ParseRate(last)
		if err != nil {
			return nil, fmt.Errorf("last price of %s: %w", ticker, err)
		}

		out = append(out, feed.Quote{
			Instrument: money.Currency(ticker),
			Quote:      "BRL",
			Date:       day,
			Value:      value,
		})
	}

	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("read the report: %w", err)
	}

	if !read {
		return nil, errors.New("read the report: no security of the day")
	}

	return out, nil
}

// splitReports is a bufio.SplitFunc whose tokens end at the end of a security.
func splitReports(data []byte, atEOF bool) (int, []byte, error) {
	if i := bytes.Index(data, endOfReport); i >= 0 {
		return i + len(endOfReport), data[:i], nil
	}

	if atEOF {
		return len(data), nil, nil
	}

	return 0, nil, nil
}

// element is the text of the first element name of data; false without one.
func element(data []byte, name string) (string, bool) {
	start := bytes.Index(data, []byte("<"+name+">"))
	if attributed := bytes.Index(data, []byte("<"+name+" ")); start < 0 ||
		attributed >= 0 && attributed < start {
		start = attributed
	}

	if start < 0 {
		return "", false
	}

	open := bytes.IndexByte(data[start:], '>')
	if open < 0 {
		return "", false
	}

	text := data[start+open+1:]

	end := bytes.IndexByte(text, '<')
	if end < 0 {
		return "", false
	}

	return string(bytes.TrimSpace(text[:end])), true
}
