// Package overnight reads overnight reference rates, annual percents on an actual/360 basis
// published each business day, as daily index rates.
package overnight

import (
	"context"
	"encoding/csv"
	"encoding/json/jsontext"
	"encoding/json/v2"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/index"
)

const (
	maxResponseBytes = 16 << 20
	decimals         = 12
	// reachDays reaches the publication before a fetch's first day and the one after its last:
	// a run of holidays and a weekend is shorter.
	reachDays = 10
)

type publication struct {
	date    time.Time
	percent string
}

// Source is one overnight rate seen as a daily index source.
type Source struct {
	hc    *http.Client
	base  string
	id    string
	index string
	read  func(ctx context.Context, s Source, from, to time.Time) ([]publication, error)
}

// ESTR is the euro short-term rate of the European Central Bank (identifier eu_estr, index estr).
func ESTR(hc *http.Client, base string) Source {
	return Source{hc: hc, base: base, id: "eu_estr", index: "estr", read: readECB}
}

// SOFR is the secured overnight financing rate of the Federal Reserve Bank of New York
// (identifier us_sofr, index sofr).
func SOFR(hc *http.Client, base string) Source {
	return Source{hc: hc, base: base, id: "us_sofr", index: "sofr", read: readNYFed}
}

func (s Source) ID() string     { return s.id }
func (s Source) Index() string  { return s.index }
func (s Source) Period() string { return index.PeriodDay }

// Fetch returns one rate per calendar day of [from, to]: a day accrues the rate last published on
// or before it, over 360, as a weekend accrues Friday's rate. A rate runs up to the next
// publication, so the days after the last one known wait for the next, and a fetch reads past
// to so that a window of a longer fetch does not end inside a weekend's run.
func (s Source) Fetch(ctx context.Context, from, to time.Time) ([]index.Rate, error) {
	pubs, err := s.read(ctx, s, from.AddDate(0, 0, -reachDays), to.AddDate(0, 0, reachDays))
	if err != nil {
		return nil, err
	}
	slices.SortFunc(pubs, func(a, b publication) int { return a.date.Compare(b.date) })
	var out []index.Rate
	for i, p := range pubs {
		value, err := perDay(p.percent)
		if err != nil {
			return out, fmt.Errorf("%s: value of %s: %w", s.id, p.date.Format(time.DateOnly), err)
		}
		next := p.date.AddDate(0, 0, 1)
		if i+1 < len(pubs) {
			next = pubs[i+1].date
		}
		for d := p.date; d.Before(next); d = d.AddDate(0, 0, 1) {
			if !d.Before(from) && !d.After(to) {
				out = append(out, index.Rate{Date: d, Value: value})
			}
		}
	}
	return out, nil
}

// perDay turns an annual percent on an actual/360 basis into the fraction of one day, rounded to
// the 12 decimals the rates are stored with: "2.442" is 0.000067833333.
func perDay(percent string) (string, error) {
	r, ok := new(big.Rat).SetString(percent)
	if !ok {
		return "", fmt.Errorf("%q is not a decimal", percent)
	}
	return r.Quo(r, big.NewRat(36000, 1)).FloatString(decimals), nil
}

func get(ctx context.Context, s Source, u string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", s.id, err)
	}
	resp, err := s.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", s.id, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s: status %d", s.id, resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return nil, fmt.Errorf("%s: %w", s.id, err)
	}
	return body, nil
}

// readECB reads the volume-weighted trimmed mean of the euro short-term rate from the ECB Data
// Portal, series EST.B.EU000A2X2A25.WT; a period without data answers an empty body.
func readECB(ctx context.Context, s Source, from, to time.Time) ([]publication, error) {
	q := url.Values{"startPeriod": {from.Format(time.DateOnly)}, "endPeriod": {to.Format(time.DateOnly)}, "format": {"csvdata"}}
	body, err := get(ctx, s, s.base+"/service/data/EST/B.EU000A2X2A25.WT?"+q.Encode())
	if err != nil || strings.TrimSpace(string(body)) == "" {
		return nil, err
	}
	records, err := csv.NewReader(strings.NewReader(string(body))).ReadAll()
	if err != nil {
		return nil, fmt.Errorf("%s: decode: %w", s.id, err)
	}
	dateAt, valueAt := slices.Index(records[0], "TIME_PERIOD"), slices.Index(records[0], "OBS_VALUE")
	if dateAt < 0 || valueAt < 0 {
		return nil, fmt.Errorf("%s: decode: no TIME_PERIOD or OBS_VALUE column", s.id)
	}
	out := make([]publication, 0, len(records)-1)
	for _, rec := range records[1:] {
		date, err := time.Parse(time.DateOnly, rec[dateAt])
		if err != nil {
			return out, fmt.Errorf("%s: date %q: %w", s.id, rec[dateAt], err)
		}
		out = append(out, publication{date: date, percent: rec[valueAt]})
	}
	return out, nil
}

// readNYFed reads SOFR from the Markets Data API of the Federal Reserve Bank of New York.
func readNYFed(ctx context.Context, s Source, from, to time.Time) ([]publication, error) {
	q := url.Values{"startDate": {from.Format(time.DateOnly)}, "endDate": {to.Format(time.DateOnly)}}
	body, err := get(ctx, s, s.base+"/api/rates/secured/sofr/search.json?"+q.Encode())
	if err != nil {
		return nil, err
	}
	var doc struct {
		RefRates []struct {
			Date    string         `json:"effectiveDate"`
			Percent jsontext.Value `json:"percentRate"`
		} `json:"refRates"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("%s: decode: %w", s.id, err)
	}
	out := make([]publication, 0, len(doc.RefRates))
	for _, r := range doc.RefRates {
		date, err := time.Parse(time.DateOnly, r.Date)
		if err != nil {
			return out, fmt.Errorf("%s: date %q: %w", s.id, r.Date, err)
		}
		if r.Percent.Kind() != '0' {
			return out, errors.New(s.id + ": percentRate of " + r.Date + " is not a number")
		}
		out = append(out, publication{date: date, percent: string(r.Percent)})
	}
	return out, nil
}
