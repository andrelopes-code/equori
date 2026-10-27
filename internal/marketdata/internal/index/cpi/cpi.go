// Package cpi reads consumer price indexes published as monthly levels, as monthly index rates:
// a month's rate is its level over the level of the month before, minus 1.
package cpi

import (
	"bytes"
	"context"
	"encoding/json/jsontext"
	"encoding/json/v2"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/index"
)

const (
	maxResponseBytes = 16 << 20
	decimals         = 12
	monthLayout      = "2006-01"
)

// level is the index level of the month that starts on month.
type level struct {
	month time.Time
	value string
}

// Source is one consumer price index seen as a monthly index source.
type Source struct {
	hc    *http.Client
	base  string
	id    string
	index string
	read  func(ctx context.Context, s Source, from, to time.Time) ([]level, error)
}

// HICP is the harmonised index of consumer prices of the euro area, from Eurostat (identifier
// ea_hicp, index hicp).
func HICP(hc *http.Client, base string) Source {
	return Source{hc: hc, base: base, id: "ea_hicp", index: "hicp", read: readEurostat}
}

// CPIU is the consumer price index for all urban consumers of the United States, from the Bureau
// of Labor Statistics (identifier us_cpi, index cpi_u).
func CPIU(hc *http.Client, base string) Source {
	return Source{hc: hc, base: base, id: "us_cpi", index: "cpi_u", read: readBLS}
}

func (s Source) ID() string     { return s.id }
func (s Source) Index() string  { return s.index }
func (s Source) Period() string { return index.PeriodMonth }

func monthOf(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// Fetch returns the rate of each month that starts in [from, to], dated on its first day as the
// IPCA is; the level of the month before the first is read to give the first its rate.
func (s Source) Fetch(ctx context.Context, from, to time.Time) ([]index.Rate, error) {
	levels, err := s.read(ctx, s, monthOf(from).AddDate(0, -1, 0), monthOf(to))
	if err != nil {
		return nil, err
	}
	slices.SortFunc(levels, func(a, b level) int { return a.month.Compare(b.month) })
	var out []index.Rate
	for i := 1; i < len(levels); i++ {
		prev, cur := levels[i-1], levels[i]
		if !cur.month.Equal(prev.month.AddDate(0, 1, 0)) || cur.month.Before(from) || cur.month.After(to) {
			continue
		}
		value, err := change(prev.value, cur.value)
		if err != nil {
			return out, fmt.Errorf("%s: %s: %w", s.id, cur.month.Format(monthLayout), err)
		}
		out = append(out, index.Rate{Date: cur.month, Value: value})
	}
	return out, nil
}

// change is cur / prev - 1, rounded to the 12 decimals the rates are stored with.
func change(prev, cur string) (string, error) {
	p, ok := new(big.Rat).SetString(prev)
	if !ok || p.Sign() <= 0 {
		return "", fmt.Errorf("level %q is not a positive decimal", prev)
	}
	c, ok := new(big.Rat).SetString(cur)
	if !ok || c.Sign() <= 0 {
		return "", fmt.Errorf("level %q is not a positive decimal", cur)
	}
	return c.Quo(c, p).Sub(c, big.NewRat(1, 1)).FloatString(decimals), nil
}

func do(s Source, req *http.Request) ([]byte, error) {
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

// readEurostat reads the euro area's all-items HICP (coicop18 TOTAL, index 2025 = 100) from the
// Eurostat dissemination API, dataset prc_hicp_minr, a JSON-stat document.
func readEurostat(ctx context.Context, s Source, from, to time.Time) ([]level, error) {
	q := url.Values{
		"geo": {"EA"}, "coicop18": {"TOTAL"}, "unit": {"I25"}, "freq": {"M"},
		"sinceTimePeriod": {from.Format(monthLayout)}, "untilTimePeriod": {to.Format(monthLayout)},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.base+"/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr?"+q.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", s.id, err)
	}
	body, err := do(s, req)
	if err != nil {
		return nil, err
	}
	var doc struct {
		Value     map[string]jsontext.Value `json:"value"`
		Dimension struct {
			Time struct {
				Category struct {
					Index map[string]int `json:"index"`
				} `json:"category"`
			} `json:"time"`
		} `json:"dimension"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("%s: decode: %w", s.id, err)
	}
	// Every other dimension holds one category, so a value's position is its month's.
	out := make([]level, 0, len(doc.Value))
	for period, pos := range doc.Dimension.Time.Category.Index {
		v, ok := doc.Value[strconv.Itoa(pos)]
		if !ok {
			continue
		}
		month, err := time.Parse(monthLayout, period)
		if err != nil {
			return nil, fmt.Errorf("%s: period %q: %w", s.id, period, err)
		}
		if v.Kind() != '0' {
			return nil, fmt.Errorf("%s: level of %s is not a number", s.id, period)
		}
		out = append(out, level{month: month, value: string(v)})
	}
	return out, nil
}

// readBLS reads series CUUR0000SA0 (all items, U.S. city average, not seasonally adjusted) from
// the public API of the Bureau of Labor Statistics, version 1, which takes no key and at most
// ten years per request.
func readBLS(ctx context.Context, s Source, from, to time.Time) ([]level, error) {
	payload := fmt.Sprintf(`{"seriesid":["CUUR0000SA0"],"startyear":"%d","endyear":"%d"}`, from.Year(), to.Year())
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.base+"/publicAPI/v1/timeseries/data/", bytes.NewBufferString(payload))
	if err != nil {
		return nil, fmt.Errorf("%s: %w", s.id, err)
	}
	req.Header.Set("Content-Type", "application/json")
	body, err := do(s, req)
	if err != nil {
		return nil, err
	}
	var doc struct {
		Status  string   `json:"status"`
		Message []string `json:"message"`
		Results struct {
			Series []struct {
				Data []struct {
					Year   string `json:"year"`
					Period string `json:"period"`
					Value  string `json:"value"`
				} `json:"data"`
			} `json:"series"`
		} `json:"Results"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("%s: decode: %w", s.id, err)
	}
	if doc.Status != "REQUEST_SUCCEEDED" {
		return nil, fmt.Errorf("%s: %s: %s", s.id, doc.Status, strings.Join(doc.Message, "; "))
	}
	var out []level
	for _, series := range doc.Results.Series {
		for _, d := range series.Data {
			// M13 is the annual average.
			if !strings.HasPrefix(d.Period, "M") || d.Period == "M13" {
				continue
			}
			month, err := time.Parse(monthLayout, d.Year+"-"+strings.TrimPrefix(d.Period, "M"))
			if err != nil {
				return nil, fmt.Errorf("%s: period %s %s: %w", s.id, d.Year, d.Period, err)
			}
			out = append(out, level{month: month, value: d.Value})
		}
	}
	return out, nil
}
