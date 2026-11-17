package yahoochart

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const id = "yahoo_chart"

// Source reads the daily chart of the Yahoo Finance public API (A222 MQ18).
type Source struct {
	client  *http.Client
	baseURL string
	targets *targets
	now     func() time.Time
}

// target is what Fetch requests for one code: the symbol and the quote currency of its answer.
type target struct {
	symbol string
	quote  money.Currency
}

// targets maps a code to its target (plan 2 D12).
type targets struct {
	mu   sync.Mutex
	byID map[money.Currency]target
}

// New returns a Source that reads the charts under baseURL.
func New(c *http.Client, baseURL string, now func() time.Time) Source {
	return Source{
		client:  c,
		baseURL: baseURL,
		targets: &targets{byID: map[money.Currency]target{}},
		now:     now,
	}
}

func (Source) ID() string { return id }

// Symbol returns the Yahoo symbol of in, false when it has none (A222 MQ19, MQ20).
func (Source) Symbol(in feed.Instrument) (string, bool) {
	if symbol := in.Symbols[id]; symbol != "" {
		return symbol, true
	}

	switch in.Type {
	case "currency":
		if in.Code == "USD" {
			return "", false
		}

		return string(in.Code) + "USD=X", true
	case "crypto":
		if in.QuoteCurrency == "" {
			return "", false
		}

		return fmt.Sprintf("%s-%s", in.Code, in.QuoteCurrency), true
	}

	suffix, ok := micSuffixes[in.Exchange]
	if !ok {
		return "", false
	}

	if suffix == "" {
		return strings.ReplaceAll(string(in.Code), ".", "-"), true
	}

	return string(in.Code) + suffix, true
}

// Codes returns the codes of ins that have a symbol, and records the target of each. A currency
// is returned only when a security of ins is quoted in it (plan 2 D29).
func (s Source) Codes(ins []feed.Instrument) []money.Currency {
	quoted := quoteCurrencies(ins)

	s.targets.mu.Lock()
	defer s.targets.mu.Unlock()

	var out []money.Currency

	for _, in := range ins {
		symbol, ok := s.Symbol(in)
		if !ok || (in.Type == "currency" && !quoted[in.Code]) {
			continue
		}

		s.targets.byID[in.Code] = target{symbol: symbol, quote: quoteOf(in)}
		out = append(out, in.Code)
	}

	return out
}

// Fetch returns the close of each day in [from, to] for each code. A 404 answer has no data for
// its code, a 429 answer ends the fetch with the quotes read so far, and any other failure is a
// ScopeError joined into the returned error while the next code still runs.
func (s Source) Fetch(
	ctx context.Context,
	codes []money.Currency,
	from, to time.Time,
) ([]feed.Quote, error) {
	var (
		out  []feed.Quote
		errs []error
	)

	for _, code := range codes {
		s.targets.mu.Lock()
		t, ok := s.targets.byID[code]
		s.targets.mu.Unlock()

		if !ok {
			continue
		}

		got, err := s.fetchCode(ctx, code, t, from, to)
		out = append(out, got...)

		var status *feed.StatusError
		if errors.As(err, &status) && status.Code == http.StatusTooManyRequests {
			return out, errors.Join(append(errs, err)...)
		}

		if err != nil {
			errs = append(errs, &feed.ScopeError{Key: "instrument", Value: string(code), Err: err})
		}
	}

	return out, errors.Join(errs...)
}

// Search asks the Yahoo search endpoint for the stocks and ETFs matching query. A quote whose
// exchange resolves to no MIC is skipped (plan 3 D7, D8). The answer states no currency: the
// listing takes the one of its MIC, or none.
func (s Source) Search(ctx context.Context, query string, limit int) ([]feed.Listing, error) {
	endpoint := fmt.Sprintf("%s/v1/finance/search?q=%s&quotesCount=%d&newsCount=0",
		strings.TrimSuffix(strings.TrimSuffix(s.baseURL, "/"), "/v8/finance/chart"),
		url.QueryEscape(query), limit)

	body, err := feed.Get(ctx, s.client, endpoint)
	if err != nil {
		return nil, fmt.Errorf("search Yahoo: %w", err)
	}

	var answer struct {
		Quotes []struct {
			Exchange  string `json:"exchange"`
			ShortName string `json:"shortname"`
			LongName  string `json:"longname"`
			QuoteType string `json:"quoteType"`
			Symbol    string `json:"symbol"`
		} `json:"quotes"`
	}
	if err := json.Unmarshal(body, &answer); err != nil {
		return nil, fmt.Errorf("decode Yahoo search: %w", err)
	}

	var out []feed.Listing

	for _, q := range answer.Quotes {
		kind := map[string]string{"EQUITY": "stock", "ETF": "etf"}[q.QuoteType]

		code, mic, ok := resolveSymbol(q.Symbol, q.Exchange)
		if kind == "" || !ok {
			continue
		}

		name := q.LongName
		if name == "" {
			name = q.ShortName
		}

		out = append(out, feed.Listing{
			Code: code, Name: name, Type: feed.SecurityType(mic, name, kind), Exchange: mic,
			QuoteCurrency: micCurrencies[mic],
			Symbol:        q.Symbol,
		})
	}

	return out, nil
}

func (s Source) fetchCode(
	ctx context.Context, code money.Currency, t target, from, to time.Time,
) ([]feed.Quote, error) {
	endpoint := fmt.Sprintf("%s/%s?period1=%d&period2=%d&interval=1d",
		s.baseURL, url.PathEscape(t.symbol), from.Unix(), to.AddDate(0, 0, 1).Unix())

	body, err := feed.Get(ctx, s.client, endpoint)
	if errors.Is(err, feed.ErrNoData) || noBars(err) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return parse(body, code, t.quote, from, to, s.now())
}

// noBars reports whether err is the 400 answer of Yahoo to a range without bars, such as a start
// date before the listing of an ETF. Any other 400 stays an error.
func noBars(err error) bool {
	var status *feed.StatusError

	return errors.As(err, &status) && status.Code == http.StatusBadRequest &&
		strings.Contains(status.Body, "Data doesn't exist")
}

// resolveSymbol returns the code and the MIC of a Yahoo symbol: the suffix after the last `.`
// names the MIC, and a symbol without one takes it from the exchange code (plan 3 D8).
func resolveSymbol(symbol, exchange string) (money.Currency, string, bool) {
	if i := strings.LastIndexByte(symbol, '.'); i >= 0 {
		for mic, suffix := range micSuffixes {
			if suffix != "" && suffix == symbol[i:] {
				return money.Currency(symbol[:i]), mic, true
			}
		}

		return "", "", false
	}

	mic, ok := yahooExchanges[exchange]

	return money.Currency(strings.ReplaceAll(symbol, "-", ".")), mic, ok
}

func quoteCurrencies(ins []feed.Instrument) map[money.Currency]bool {
	out := make(map[money.Currency]bool)

	for _, in := range ins {
		if in.Type != "currency" && in.QuoteCurrency != "" {
			out[in.QuoteCurrency] = true
		}
	}

	return out
}

// quoteOf returns the currency Yahoo quotes in: USD for a currency, the quote currency otherwise.
func quoteOf(in feed.Instrument) money.Currency {
	if in.Type == "currency" {
		return "USD"
	}

	return in.QuoteCurrency
}
