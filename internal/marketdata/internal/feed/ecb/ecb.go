package ecb

import (
	"context"
	"encoding/xml"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Source reads the euro foreign exchange reference rates published by the European Central Bank.
// The ECB publishes units of each currency per euro, so each quote is the price of EUR in that
// currency, stored without inversion.
type Source struct {
	client *http.Client
	url    string
}

// New returns a Source that reads the XML file at url.
func New(c *http.Client, url string) Source { return Source{client: c, url: url} }

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

// Fetch returns the rate of each code for each day of [from, to] present in the file.
// A code the file does not list is skipped.
func (s Source) Fetch(ctx context.Context, codes []money.Currency, from, to time.Time) ([]feed.Quote, error) {
	body, err := feed.Get(ctx, s.client, s.url)
	if err != nil {
		return nil, fmt.Errorf("fetch ECB rates: %w", err)
	}
	var env envelope
	if err := xml.Unmarshal(body, &env); err != nil {
		return nil, fmt.Errorf("read ECB rates: %w", err)
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
	return out, nil
}
