// Package brfocus reads the Focus survey of the Banco Central do Brasil: the medians of the
// Selic target at the end of each year, as points of the CDI (ADR 026 E2).
package brfocus

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/expectation"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
)

const decimals = 12

// cdiSpread is the Selic target minus the annualized CDI, in percentage points: SGS 432 (13.75)
// minus SGS 4389 (13.65) on 2026-10-26.
var cdiSpread = big.NewRat(10, 100)

type Source struct {
	hc   *http.Client
	base string
}

// New reads the Olinda service of the Expectativas API at base.
func New(hc *http.Client, base string) Source { return Source{hc: hc, base: base} }

func (Source) ID() string    { return "br_focus" }
func (Source) Index() string { return "cdi" }

type row struct {
	Date   string      `json:"Data"`
	Year   string      `json:"DataReferencia"`
	Median json.Number `json:"Mediana"`
}

func (s Source) Fetch(ctx context.Context) (expectation.Survey, error) {
	// Olinda refuses a space written as "+" and an escaped "$", which url.Values.Encode writes.
	q := "$filter=" + url.PathEscape("Indicador eq 'Selic' and baseCalculo eq 0") +
		"&$orderby=" + url.PathEscape("Data desc") +
		"&$top=20&$select=Data,DataReferencia,Mediana&$format=json"
	body, err := feed.Get(ctx, s.hc, s.base+"/ExpectativasMercadoAnuais?"+q)
	if err != nil {
		return expectation.Survey{}, fmt.Errorf("br_focus: %w", err)
	}
	var doc struct {
		Value []row `json:"value"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return expectation.Survey{}, fmt.Errorf("br_focus: decode: %w", err)
	}
	if len(doc.Value) == 0 {
		return expectation.Survey{}, fmt.Errorf("br_focus: %w", feed.ErrNoData)
	}
	latest := doc.Value[0].Date
	for _, r := range doc.Value {
		latest = max(latest, r.Date)
	}
	date, err := time.Parse(time.DateOnly, latest)
	if err != nil {
		return expectation.Survey{}, fmt.Errorf("br_focus: date %q: %w", latest, err)
	}
	out := expectation.Survey{Date: date}
	for _, r := range doc.Value {
		if r.Date != latest {
			continue
		}
		end, err := time.Parse(time.DateOnly, r.Year+"-12-31")
		if err != nil {
			return expectation.Survey{}, fmt.Errorf("br_focus: year %q: %w", r.Year, err)
		}
		median, ok := new(big.Rat).SetString(r.Median.String())
		if !ok {
			return expectation.Survey{}, fmt.Errorf("br_focus: median %q of %s", r.Median, r.Year)
		}
		rate := median.Sub(median, cdiSpread)
		rate.Quo(rate, big.NewRat(100, 1))
		out.Points = append(out.Points, expectation.Point{Date: end, Rate: rate.FloatString(decimals)})
	}
	slices.SortFunc(out.Points, func(a, b expectation.Point) int { return a.Date.Compare(b.Date) })
	return out, nil
}
