// Package brsgs reads daily and monthly index series of the Banco Central do Brasil SGS.
package brsgs

import (
	"context"
	"encoding/json/v2"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/index"
)

const (
	dateLayout       = "02/01/2006"
	maxResponseBytes = 16 << 20
	// SGS series: 12 is the CDI in percent a day, 433 the IPCA in percent a month.
	seriesCDI  = 12
	seriesIPCA = 433
	decimals   = 12
)

// Source is one SGS series seen as an index source.
type Source struct {
	hc     *http.Client
	base   string
	id     string
	index  string
	series int
}

// CDI is the daily CDI rate (identifier br_cdi, index cdi).
func CDI(hc *http.Client, base string) Source {
	return Source{hc: hc, base: base, id: "br_cdi", index: "cdi", series: seriesCDI}
}

// IPCA is the monthly IPCA variation (identifier br_ipca, index ipca).
func IPCA(hc *http.Client, base string) Source {
	return Source{hc: hc, base: base, id: "br_ipca", index: "ipca", series: seriesIPCA}
}

func (s Source) ID() string    { return s.id }
func (s Source) Index() string { return s.index }

type item struct {
	Date  string `json:"data"`
	Value string `json:"valor"`
}

func (s Source) Fetch(ctx context.Context, from, to time.Time) ([]index.Rate, error) {
	q := url.Values{"formato": {"json"}, "dataInicial": {from.Format(dateLayout)}, "dataFinal": {to.Format(dateLayout)}}
	u := fmt.Sprintf("%s/dados/serie/bcdata.sgs.%d/dados?%s", s.base, s.series, q.Encode())
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
	var items []item
	if err := json.Unmarshal(body, &items); err != nil {
		return nil, fmt.Errorf("%s: decode: %w", s.id, err)
	}
	out := make([]index.Rate, 0, len(items))
	for _, it := range items {
		date, err := time.Parse(dateLayout, it.Date)
		if err != nil {
			return out, fmt.Errorf("%s: date %q: %w", s.id, it.Date, err)
		}
		value, err := percentToFraction(it.Value)
		if err != nil {
			return out, fmt.Errorf("%s: value of %s: %w", s.id, it.Date, err)
		}
		out = append(out, index.Rate{Date: date, Value: value})
	}
	return out, nil
}

// percentToFraction turns "0.055131" (percent) into "0.000551310000" exactly.
func percentToFraction(percent string) (string, error) {
	r, ok := new(big.Rat).SetString(percent)
	if !ok {
		return "", fmt.Errorf("%q is not a decimal", percent)
	}
	r.Quo(r, big.NewRat(100, 1))
	text := r.FloatString(decimals)
	if back, _ := new(big.Rat).SetString(text); back.Cmp(r) != 0 {
		return "", fmt.Errorf("%q has more than %d decimals once a fraction", percent, decimals)
	}
	return text, nil
}
