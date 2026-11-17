// Package brfocus reads the Focus survey of the Banco Central do Brasil: the medians of the
// Selic target at the end of each year as points of the CDI (ADR 026 E2), and the medians of
// the IPCA as points of the ipca (ADR 026 E12).
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

	"github.com/andrelopes-code/equori/internal/marketdata/expectation"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
)

const decimals = 12

// cdiSpread is the Selic target minus the annualized CDI, in percentage points: SGS 432 (13.75)
// minus SGS 4389 (13.65) on 2026-10-26.
var cdiSpread = big.NewRat(10, 100)

type Source struct {
	hc        *http.Client
	base      string
	id        string
	index     string
	indicator string
	spread    *big.Rat
}

// New reads the Olinda service of the Expectativas API at base.
func New(hc *http.Client, base string) Source {
	return Source{
		hc:        hc,
		base:      base,
		id:        "br_focus",
		index:     "cdi",
		indicator: "Selic",
		spread:    cdiSpread,
	}
}

// NewIPCA reads the medians of the IPCA of each year (ADR 026 E12).
func NewIPCA(hc *http.Client, base string) Source {
	return Source{
		hc:        hc,
		base:      base,
		id:        "br_focus_ipca",
		index:     "ipca",
		indicator: "IPCA",
		spread:    new(big.Rat),
	}
}

func (s Source) ID() string    { return s.id }
func (s Source) Index() string { return s.index }

type row struct {
	Date   string      `json:"Data"`
	Year   string      `json:"DataReferencia"`
	Median json.Number `json:"Mediana"`
}

func (s Source) Fetch(ctx context.Context) (expectation.Survey, error) {
	// Olinda refuses a space written as "+" and an escaped "$", which url.Values.Encode writes.
	q := "$filter=" + url.PathEscape("Indicador eq '"+s.indicator+"' and baseCalculo eq 0") +
		"&$orderby=" + url.PathEscape("Data desc") +
		"&$top=20&$select=Data,DataReferencia,Mediana&$format=json"

	body, err := feed.Get(ctx, s.hc, s.base+"/ExpectativasMercadoAnuais?"+q)
	if err != nil {
		return expectation.Survey{}, fmt.Errorf("%s: %w", s.id, err)
	}

	var doc struct {
		Value []row `json:"value"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return expectation.Survey{}, fmt.Errorf("%s: decode: %w", s.id, err)
	}

	if len(doc.Value) == 0 {
		return expectation.Survey{}, fmt.Errorf("%s: %w", s.id, feed.ErrNoData)
	}

	latest := latestDate(doc.Value)

	date, err := time.Parse(time.DateOnly, latest)
	if err != nil {
		return expectation.Survey{}, fmt.Errorf("%s: date %q: %w", s.id, latest, err)
	}

	out := expectation.Survey{Date: date}

	out.Points, err = s.surveyPoints(doc.Value, latest)
	if err != nil {
		return expectation.Survey{}, err
	}

	slices.SortFunc(out.Points, func(a, b expectation.Point) int { return a.Date.Compare(b.Date) })

	return out, nil
}

func latestDate(rows []row) string {
	latest := rows[0].Date
	for _, r := range rows {
		latest = max(latest, r.Date)
	}

	return latest
}

func (s Source) surveyPoints(rows []row, latest string) ([]expectation.Point, error) {
	var points []expectation.Point
	for _, r := range rows {
		if r.Date != latest {
			continue
		}

		end, err := time.Parse(time.DateOnly, r.Year+"-12-31")
		if err != nil {
			return nil, fmt.Errorf("%s: year %q: %w", s.id, r.Year, err)
		}

		median, ok := new(big.Rat).SetString(r.Median.String())
		if !ok {
			return nil, fmt.Errorf("%s: median %q of %s", s.id, r.Median, r.Year)
		}

		rate := median.Sub(median, s.spread)
		rate.Quo(rate, big.NewRat(100, 1))
		points = append(points, expectation.Point{Date: end, Rate: rate.FloatString(decimals)})
	}

	return points, nil
}
