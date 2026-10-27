package b3cotahist

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
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

// Fetch returns the spot-market closing price (in BRL) of each code for each weekday of
// [from, to]. A day with no data is skipped. The first failing day ends the run: its
// failure, a feed.ScopeError, is returned with the quotes of the earlier days.
func (c Source) Fetch(ctx context.Context, codes []money.Currency, from, to time.Time) ([]feed.Quote, error) {
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
	if len(zr.File) != 1 {
		return nil, fmt.Errorf("open %s: %d files in the ZIP", name, len(zr.File))
	}
	f, err := zr.File[0].Open()
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", name, err)
	}
	defer func() { _ = f.Close() }()

	want := day.Format("20060102")
	var out []feed.Quote
	sc := bufio.NewScanner(f)
	for line := 1; sc.Scan(); line++ {
		rec := strings.Map(ascii, strings.TrimRight(sc.Text(), "\r"))
		if !strings.HasPrefix(rec, "01") {
			continue
		}
		if len(rec) != recordLength || rec[dateFrom:dateTo] != want {
			return nil, fmt.Errorf("read %s line %d: not a record of %s", name, line, want)
		}
		ticker := strings.TrimSpace(rec[tickerFrom:tickerTo])
		if rec[marketFrom:marketTo] != spotMarket || !slices.Contains(tickers, ticker) {
			continue
		}
		cents, err := strconv.ParseInt(rec[closeFrom:closeTo], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("read %s line %d: %w", name, line, err)
		}
		value, err := money.NewRate(cents, 2)
		if err != nil {
			return nil, fmt.Errorf("read %s line %d: %w", name, line, err)
		}
		out = append(out, feed.Quote{Instrument: money.Currency(ticker), Quote: "BRL", Date: day, Value: value})
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("read %s: %w", name, err)
	}
	return out, nil
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
