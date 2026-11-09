package ecb

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/csv"
	"encoding/xml"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// histFile is the full-series ZIP beside the 90-day file (plan D13).
const histFile = "eurofxref-hist.zip"

// Source reads the euro foreign exchange reference rates published by the European Central Bank.
// The ECB publishes units of each currency per euro, so each quote is the price of EUR in that
// currency, stored without inversion.
type Source struct {
	client *http.Client
	url    string
	seen   *feed.Conditional
}

// New returns a Source that reads the XML file at url.
func New(c *http.Client, url string) Source {
	return Source{client: c, url: url, seen: feed.NewConditional()}
}

func (Source) ID() string { return "ecb" }

// Codes returns the currency instruments other than EUR, sorted by code.
func (Source) Codes(ins []feed.Instrument) []money.Currency {
	var out []money.Currency
	for _, in := range ins {
		if in.Type == "currency" && in.Code != "EUR" {
			out = append(out, in.Code)
		}
	}

	slices.Sort(out)

	return slices.Compact(out)
}

type envelope struct {
	Days []struct {
		Time  string `xml:"time,attr"`
		Rates []struct {
			Currency string `xml:"currency,attr"`
			Rate     string `xml:"rate,attr"`
		} `xml:"Cube"`
	} `xml:"Cube>Cube"`
}

// Fetch returns the rate of each code for each day of [from, to]. When from is before the
// earliest date of the 90-day file, every date of the range comes from the full-series ZIP.
// A code the file does not list is skipped.
func (s Source) Fetch(ctx context.Context, codes []money.Currency, from, to time.Time) ([]feed.Quote, error) {
	key := s.url + "|" + joinCodes(codes)

	since := ""
	if feed.Incremental(from, to) {
		since = s.seen.Since(key)
	}

	body, lastModified, err := feed.GetSince(ctx, s.client, s.url, since)
	if errors.Is(err, feed.ErrNoData) && since != "" {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("fetch ECB rates: %w", err)
	}

	var env envelope
	if err := xml.Unmarshal(body, &env); err != nil {
		return nil, fmt.Errorf("read ECB rates: %w", err)
	}

	earliest := ""
	for _, d := range env.Days {
		if earliest == "" || d.Time < earliest {
			earliest = d.Time
		}
	}

	if earliest != "" && from.Format(time.DateOnly) < earliest {
		return s.fetchHistory(ctx, codes, from, to)
	}

	var out []feed.Quote
	for _, d := range env.Days {
		date, err := time.Parse(time.DateOnly, d.Time)
		if err != nil {
			return nil, fmt.Errorf("read ECB date %q: %w", d.Time, err)
		}

		if date.Before(from) || date.After(to) {
			continue
		}

		for _, r := range d.Rates {
			if !slices.Contains(codes, money.Currency(r.Currency)) {
				continue
			}

			rate, err := money.ParseRate(r.Rate)
			if err != nil {
				return nil, fmt.Errorf("read ECB %s rate on %s: %w", r.Currency, d.Time, err)
			}

			out = append(out, feed.Quote{Instrument: "EUR", Quote: money.Currency(r.Currency), Date: date, Value: rate})
		}
	}

	s.seen.Remember(key, lastModified)

	return out, nil
}

func (s Source) fetchHistory(ctx context.Context, codes []money.Currency, from, to time.Time) ([]feed.Quote, error) {
	url := s.url[:strings.LastIndex(s.url, "/")+1] + histFile

	body, err := feed.Get(ctx, s.client, url)
	if err != nil {
		return nil, fmt.Errorf("fetch ECB history: %w", err)
	}

	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		return nil, fmt.Errorf("read ECB history: %w", err)
	}

	if len(zr.File) != 1 {
		return nil, fmt.Errorf("read ECB history: %d files in the ZIP, want 1", len(zr.File))
	}

	f, err := zr.File[0].Open()
	if err != nil {
		return nil, fmt.Errorf("read ECB history: %w", err)
	}
	defer f.Close()

	cr := csv.NewReader(f)
	cr.FieldsPerRecord = -1

	rows, err := cr.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("read ECB history: %w", err)
	}

	if len(rows) == 0 {
		return nil, nil
	}

	var out []feed.Quote
	for _, row := range rows[1:] {
		date, err := time.Parse(time.DateOnly, row[0])
		if err != nil {
			return nil, fmt.Errorf("read ECB date %q: %w", row[0], err)
		}

		if date.Before(from) || date.After(to) {
			continue
		}

		for i, code := range rows[0][1:] {
			i++
			if !slices.Contains(codes, money.Currency(code)) || i >= len(row) || row[i] == "" || row[i] == "N/A" {
				continue
			}

			rate, err := money.ParseRate(row[i])
			if err != nil {
				return nil, fmt.Errorf("read ECB %s rate on %s: %w", code, row[0], err)
			}

			out = append(out, feed.Quote{Instrument: "EUR", Quote: money.Currency(code), Date: date, Value: rate})
		}
	}

	return out, nil
}

func joinCodes(codes []money.Currency) string {
	parts := make([]string, len(codes))
	for i, c := range codes {
		parts[i] = string(c)
	}

	return strings.Join(parts, ",")
}
