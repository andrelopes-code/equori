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

	"github.com/andrelopes-code/equori/internal/marketdata/index"
)

const (
	dateLayout       = "02/01/2006"
	maxResponseBytes = 16 << 20
	// SGS series: 12 is the CDI in percent a day, 11 the Selic in percent a day and 28655 the IGP-M
	// in percent a month with 10 decimals, from the index numbers of the FGV; series 189 rounds it
	// to 2 decimals, which drifts from the factor of an NTN-C (coverage row T-05).
	seriesCDI   = 12
	seriesSelic = 11
	seriesIGPM  = 28655
	// seriesPTAX is the PTAX selling rate of the dollar in reais, a quote of each business day.
	seriesPTAX = 1
	decimals   = 12
	// quoteLookback reaches the quote before the first day asked, which its variation needs.
	quoteLookback = 10
)

// bondBase is the base date of the VNA of the LFT and of the NTN-C, 2000-07-01 (Tesouro Nacional,
// Metodologia de Cálculo dos Títulos Públicos Federais, read 2026-11-19).
var bondBase = time.Date(2000, time.July, 1, 0, 0, 0, 0, time.UTC)

// Source is one SGS series seen as an index source.
type Source struct {
	hc     *http.Client
	base   string
	id     string
	index  string
	series int
	period string

	businessDay bool
	// quotes marks a series of quotes, not of rates: its rate of a day is the quote of that day
	// over the quote of the business day before, less one.
	quotes bool
	// since is the first day the store holds, zero for the default history.
	since time.Time
}

// CDI is the daily CDI rate (identifier br_cdi, index cdi). It compounds by business day
// (index.BusinessDayCompounding).
func CDI(hc *http.Client, base string) Source {
	return Source{
		hc: hc, base: base, id: "br_cdi", index: "cdi", series: seriesCDI, period: index.PeriodDay,
		businessDay: true,
	}
}

// Selic is the daily Selic rate (identifier br_selic, index selic), the rate of the Tesouro Selic
// (LFT). It compounds by business day.
func Selic(hc *http.Client, base string) Source {
	return Source{
		hc: hc, base: base, id: "br_selic", index: "selic", series: seriesSelic,
		period: index.PeriodDay, businessDay: true, since: bondBase,
	}
}

// IGPM is the monthly IGP-M variation (identifier br_igpm, index igpm), the index of the
// Tesouro IGP-M+ (NTN-C) and of rents.
func IGPM(hc *http.Client, base string) Source {
	return Source{
		hc:     hc,
		base:   base,
		id:     "br_igpm",
		index:  "igpm",
		series: seriesIGPM,
		period: index.PeriodMonth,
		since:  bondBase,
	}
}

// Dollar is the daily variation of the PTAX selling rate of the dollar (identifier br_ptax_usd,
// index usd_brl), the index of a security indexed to the exchange rate (coverage row F-21). It
// compounds by business day: the product of the rates from the issue to a day, exclusive, is the
// quote of the business day before that day over the quote of the business day before the issue,
// the PTAX of D-1 the market uses.
func Dollar(hc *http.Client, base string) Source {
	return Source{
		hc: hc, base: base, id: "br_ptax_usd", index: "usd_brl", series: seriesPTAX,
		period: index.PeriodDay, businessDay: true, quotes: true,
	}
}

func (s Source) ID() string { return s.id }

// HistorySince is the first day the store holds: the base of the VNA of a bond that follows the
// index (index.HistoryStart).
func (s Source) HistorySince() time.Time { return s.since }
func (s Source) Index() string           { return s.index }
func (s Source) Period() string          { return s.period }

func (s Source) CompoundsByBusinessDay() bool { return s.businessDay }

// Calendar is the banking calendar of the daily series: their dates over 20 years are its business
// days (measured on 2026-11-24).
func (s Source) Calendar() string {
	if s.period == index.PeriodDay {
		return "br_banking"
	}

	return ""
}

type item struct {
	Date  string `json:"data"`
	Value string `json:"valor"`
}

func (s Source) Fetch(ctx context.Context, from, to time.Time) ([]index.Rate, error) {
	start := from
	if s.quotes {
		start = from.AddDate(0, 0, -quoteLookback)
	}

	req, err := s.newRequest(ctx, start, to)
	if err != nil {
		return nil, err
	}

	resp, err := s.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", s.id, err)
	}
	defer resp.Body.Close()
	// The SGS answers 404 for dates that hold no value: a weekend, or days not yet published.
	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s: status %d", s.id, resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return nil, fmt.Errorf("%s: %w", s.id, err)
	}

	if s.quotes {
		return s.parseQuotes(body)
	}

	return s.parseRates(body)
}

func (s Source) newRequest(ctx context.Context, from, to time.Time) (*http.Request, error) {
	q := url.Values{
		"formato":     {"json"},
		"dataInicial": {from.Format(dateLayout)},
		"dataFinal":   {to.Format(dateLayout)},
	}
	u := fmt.Sprintf("%s/dados/serie/bcdata.sgs.%d/dados?%s", s.base, s.series, q.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", s.id, err)
	}

	return req, nil
}

func (s Source) parseRates(body []byte) ([]index.Rate, error) {
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

// parseQuotes turns the quotes of the body, which reach before the days asked, into the variation
// of each quote day from the quote day before, rounded half to even to 12 decimals.
func (s Source) parseQuotes(body []byte) ([]index.Rate, error) {
	var items []item
	if err := json.Unmarshal(body, &items); err != nil {
		return nil, fmt.Errorf("%s: decode: %w", s.id, err)
	}

	var out []index.Rate

	for i := 0; i+1 < len(items); i++ {
		date, err := time.Parse(dateLayout, items[i+1].Date)
		if err != nil {
			return out, fmt.Errorf("%s: date %q: %w", s.id, items[i+1].Date, err)
		}

		now, okNow := new(big.Rat).SetString(items[i].Value)

		next, okNext := new(big.Rat).SetString(items[i+1].Value)
		if !okNow || !okNext || now.Sign() <= 0 {
			return out, fmt.Errorf("%s: quote of %s is not a positive decimal", s.id, items[i].Date)
		}

		v := new(big.Rat).Sub(new(big.Rat).Quo(next, now), big.NewRat(1, 1))
		out = append(out, index.Rate{Date: date, Value: roundHalfEven(v)})
	}

	return out, nil
}

// roundHalfEven writes r with 12 decimals, a tie to the even last digit.
func roundHalfEven(r *big.Rat) string {
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(decimals), nil)
	n := new(big.Int).Mul(r.Num(), scale)
	q, m := new(big.Int).QuoRem(n, r.Denom(), new(big.Int))

	twice := new(big.Int).Abs(new(big.Int).Lsh(m, 1))
	if c := twice.Cmp(r.Denom()); c > 0 || c == 0 && q.Bit(0) == 1 {
		q.Add(q, big.NewInt(int64(n.Sign())))
	}

	return new(big.Rat).SetFrac(q, scale).FloatString(decimals)
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
