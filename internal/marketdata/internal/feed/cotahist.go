package feed

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

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

// COTAHIST reads the B3 daily historical quotes file.
type COTAHIST struct {
	client  *http.Client
	baseURL string
}

func NewCOTAHIST(c *http.Client, baseURL string) COTAHIST {
	return COTAHIST{client: c, baseURL: strings.TrimSuffix(baseURL, "/")}
}

// Fetch returns the spot-market closing price (in BRL) of each ticker traded on day.
// A malformed file returns an error and no quote.
func (c COTAHIST) Fetch(ctx context.Context, day time.Time, tickers []string) ([]Quote, error) {
	name := "COTAHIST_D" + day.Format("02012006")
	body, err := get(ctx, c.client, c.baseURL+"/"+name+".ZIP")
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
	var out []Quote
	sc := bufio.NewScanner(f)
	for line := 1; sc.Scan(); line++ {
		rec := strings.TrimRight(sc.Text(), "\r")
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
		out = append(out, Quote{Instrument: money.Currency(ticker), Quote: "BRL", Date: day, Value: value})
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("read %s: %w", name, err)
	}
	return out, nil
}
