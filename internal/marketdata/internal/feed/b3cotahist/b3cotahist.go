package b3cotahist

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Byte ranges of a type 01 record of the B3 historical quotes layout (245 bytes).
const (
	recordLength = 245
	dateFrom     = 2
	dateTo       = 10
	tickerFrom   = 12
	tickerTo     = 24
	marketFrom   = 24
	marketTo     = 27
	closeFrom    = 108
	closeTo      = 121
	spotMarket   = "010"
)

// Source reads the B3 daily historical quotes file.
type Source struct {
	client  *http.Client
	baseURL string
}

func New(c *http.Client, baseURL string) Source {
	return Source{client: c, baseURL: strings.TrimSuffix(baseURL, "/")}
}

func (Source) ID() string { return "b3_cotahist" }

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

// Fetch returns the spot-market closing price (in BRL) of each code for each date of [from, to].
// A range over 31 days reads the year files first, then the daily files from the day after the
// latest year-file record (D14). A day with no data is skipped. The first failing file ends the
// run: its failure, a feed.ScopeError, is returned with the quotes read before it.
func (c Source) Fetch(ctx context.Context, codes []money.Currency, from, to time.Time) ([]feed.Quote, error) {
	var out []feed.Quote

	dayFrom := from

	if from.Before(to.AddDate(0, 0, -31)) {
		years, latest, err := c.FetchYears(ctx, codes, from, to)
		if err != nil {
			return years, err
		}

		out = years
		dayFrom = to.AddDate(0, 0, -30)

		if next := latest.AddDate(0, 0, 1); !latest.IsZero() && next.After(dayFrom) {
			dayFrom = next
		}

		if from.After(dayFrom) {
			dayFrom = from
		}
	}

	days, err := c.fetchDays(ctx, codes, dayFrom, to)

	return append(out, days...), err
}

// FetchYears returns the spot-market closing price of each code for each date of [from, to]
// held by the year files of the years of from to to, and the latest record date read from them
// (zero when none was read). A missing year is skipped. Each quote carries Source b3_cotahist.
func (c Source) FetchYears(ctx context.Context, codes []money.Currency, from, to time.Time) ([]feed.Quote, time.Time, error) {
	tickers := tickerSet(codes)

	var (
		out    []feed.Quote
		latest time.Time
	)

	for year := from.Year(); year <= to.Year(); year++ {
		name := fmt.Sprintf("COTAHIST_A%d", year)

		err := feed.Download(ctx, c.client, c.baseURL+"/"+name+".ZIP", func(f *os.File, size int64) error {
			zr, err := zip.NewReader(f, size)
			if err != nil {
				return fmt.Errorf("open %s: %w", name, err)
			}

			quotes, last, err := readZIP(zr, name, tickers, from, to, false)
			if err != nil {
				return err
			}

			out = append(out, quotes...)

			if last.After(latest) {
				latest = last
			}

			return nil
		})
		if errors.Is(err, feed.ErrNoData) {
			continue
		}

		if err != nil {
			return out, latest, &feed.ScopeError{Key: "year", Value: strconv.Itoa(year), Err: err}
		}
	}

	return out, latest, nil
}

func (c Source) fetchDays(ctx context.Context, codes []money.Currency, from, to time.Time) ([]feed.Quote, error) {
	tickers := make([]string, len(codes))
	for i, code := range codes {
		tickers[i] = string(code)
	}

	var out []feed.Quote
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
			continue
		}

		quotes, err := c.FetchDay(ctx, d, tickers)
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

// FetchDay returns the spot-market closing price of each ticker traded on day.
// A malformed file returns an error and no quote.
func (c Source) FetchDay(ctx context.Context, day time.Time, tickers []string) ([]feed.Quote, error) {
	name := "COTAHIST_D" + day.Format("02012006")

	body, err := feed.Get(ctx, c.client, c.baseURL+"/"+name+".ZIP")
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", name, err)
	}

	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", name, err)
	}

	set := make(map[string]bool, len(tickers))
	for _, t := range tickers {
		set[t] = true
	}

	quotes, _, err := readZIP(zr, name, set, day, day, true)

	return quotes, err
}

func tickerSet(codes []money.Currency) map[string]bool {
	set := make(map[string]bool, len(codes))
	for _, code := range codes {
		set[string(code)] = true
	}

	return set
}

// readZIP reads the records of the only file of zr. A day file (strict) holds only records of
// from; a year file keeps the records dated in [from, to]. It returns the latest date of those
// records.
func readZIP(zr *zip.Reader, name string, tickers map[string]bool, from, to time.Time, strict bool) ([]feed.Quote, time.Time, error) {
	if len(zr.File) != 1 {
		return nil, time.Time{}, fmt.Errorf("open %s: %d files in the ZIP", name, len(zr.File))
	}

	f, err := zr.File[0].Open()
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("open %s: %w", name, err)
	}

	defer func() { _ = f.Close() }()

	var (
		out    []feed.Quote
		latest time.Time
	)

	sc := bufio.NewScanner(f)
	for line := 1; sc.Scan(); line++ {
		rec := strings.Map(ascii, strings.TrimRight(sc.Text(), "\r"))
		if !strings.HasPrefix(rec, "01") {
			continue
		}

		date, err := time.Parse("20060102", safeSlice(rec, dateFrom, dateTo))
		if len(rec) != recordLength || (strict && !date.Equal(from)) || err != nil {
			return nil, time.Time{}, fmt.Errorf("read %s line %d: not a record of %s", name, line, from.Format("20060102"))
		}

		if date.Before(from) || date.After(to) {
			continue
		}

		if date.After(latest) {
			latest = date
		}

		ticker := strings.TrimSpace(rec[tickerFrom:tickerTo])
		if rec[marketFrom:marketTo] != spotMarket || !tickers[ticker] {
			continue
		}

		cents, err := strconv.ParseInt(rec[closeFrom:closeTo], 10, 64)
		if err != nil {
			return nil, time.Time{}, fmt.Errorf("read %s line %d: %w", name, line, err)
		}

		value, err := money.NewRate(cents, 2)
		if err != nil {
			return nil, time.Time{}, fmt.Errorf("read %s line %d: %w", name, line, err)
		}

		q := feed.Quote{Instrument: money.Currency(ticker), Quote: "BRL", Date: date, Value: value}
		if !strict {
			q.Source = "b3_cotahist"
		}

		out = append(out, q)
	}

	if err := sc.Err(); err != nil {
		return nil, time.Time{}, fmt.Errorf("read %s: %w", name, err)
	}

	return out, latest, nil
}

func safeSlice(s string, from, to int) string {
	if len(s) < to {
		return ""
	}

	return s[from:to]
}

// ascii keeps the byte offsets of the layout when a company name holds a character outside
// ASCII, which the B3 writes in Latin-1 and, in the file of 2026-10-22, in UTF-8: each such
// character, one or two bytes, becomes one '?'.
func ascii(r rune) rune {
	if r > unicode.MaxASCII {
		return '?'
	}

	return r
}
