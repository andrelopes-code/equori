package yahoochart

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const id = "yahoo_chart"

// micSuffixes maps the MIC of an exchange to the suffix Yahoo appends to a code (A222 MQ19).
// An empty suffix means the code is requested as is, with `.` read as `-`.
var micSuffixes = map[string]string{
	"BVMF": ".SA",
	"XNYS": "", "XNAS": "", "ARCX": "", "BATS": "", "XASE": "",
	"XTSE": ".TO", "XLON": ".L", "XETR": ".DE", "XFRA": ".F", "XPAR": ".PA",
	"XAMS": ".AS", "XBRU": ".BR", "XLIS": ".LS", "XMIL": ".MI", "XMAD": ".MC",
	"XSWX": ".SW", "XSTO": ".ST", "XCSE": ".CO", "XHEL": ".HE", "XOSL": ".OL",
	"XWBO": ".VI", "XDUB": ".IR", "XASX": ".AX", "XTKS": ".T", "XHKG": ".HK",
	"XKRX": ".KS", "XNSE": ".NS", "XMEX": ".MX", "XBUE": ".BA", "XJSE": ".JO",
	"XSES": ".SI",
}

// micCurrencies maps the MIC of an exchange to the currency Yahoo quotes it in, so that a search
// listing states its currency (A223 RM8). Region-dependent. XLON and XJSE are absent: they quote
// in a subunit (pence, cents), which no currency instrument holds.
var micCurrencies = map[string]money.Currency{
	"BVMF": "BRL",
	"XNYS": "USD", "XNAS": "USD", "ARCX": "USD", "BATS": "USD", "XASE": "USD",
	"XTSE": "CAD", "XETR": "EUR", "XFRA": "EUR", "XPAR": "EUR", "XAMS": "EUR", "XBRU": "EUR",
	"XLIS": "EUR", "XMIL": "EUR", "XMAD": "EUR", "XHEL": "EUR", "XWBO": "EUR", "XDUB": "EUR",
	"XSWX": "CHF", "XSTO": "SEK", "XCSE": "DKK", "XOSL": "NOK", "XASX": "AUD", "XTKS": "JPY",
	"XHKG": "HKD", "XKRX": "KRW", "XNSE": "INR", "XMEX": "MXN", "XBUE": "ARS", "XSES": "SGD",
}

// yahooExchanges maps the exchange code of a Yahoo search answer to a MIC, for a symbol without a
// suffix (plan 3 D8). Region-dependent: a US listing is the only case without a suffix.
var yahooExchanges = map[string]string{"NMS": "XNAS", "NYQ": "XNYS", "PCX": "ARCX"}

// Source reads the daily chart of the Yahoo Finance public API (A222 MQ18).
type Source struct {
	client  *http.Client
	baseURL string
	targets *targets
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
func New(c *http.Client, baseURL string) Source {
	return Source{client: c, baseURL: baseURL, targets: &targets{byID: map[money.Currency]target{}}}
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

		quote := in.QuoteCurrency
		if in.Type == "currency" {
			quote = "USD"
		}

		s.targets.byID[in.Code] = target{symbol: symbol, quote: quote}
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
	if errors.Is(err, feed.ErrNoData) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return parse(body, code, t.quote, from, to)
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

func parse(body []byte, code, quote money.Currency, from, to time.Time) ([]feed.Quote, error) {
	var answer struct {
		Chart struct {
			Result []struct {
				Meta struct {
					Currency             string `json:"currency"`
					ExchangeTimezoneName string `json:"exchangeTimezoneName"`
				} `json:"meta"`
				Timestamp  []int64 `json:"timestamp"`
				Indicators struct {
					Quote []struct {
						Close []*float64 `json:"close"`
					} `json:"quote"`
				} `json:"indicators"`
			} `json:"result"`
		} `json:"chart"`
	}

	if err := json.Unmarshal(body, &answer); err != nil {
		return nil, fmt.Errorf("decode Yahoo chart: %w", err)
	}

	if len(answer.Chart.Result) == 0 || len(answer.Chart.Result[0].Indicators.Quote) == 0 {
		return nil, nil
	}

	result := answer.Chart.Result[0]

	if result.Meta.Currency != string(quote) {
		return nil, fmt.Errorf("quoted in %s, want %s", result.Meta.Currency, quote)
	}

	loc, err := time.LoadLocation(result.Meta.ExchangeTimezoneName)
	if err != nil {
		return nil, fmt.Errorf(
			"load exchange time zone %q: %w",
			result.Meta.ExchangeTimezoneName,
			err,
		)
	}

	return closeQuotes(
		result.Indicators.Quote[0].Close,
		result.Timestamp,
		loc,
		code,
		quote,
		from,
		to,
	)
}

func closeQuotes(
	closes []*float64,
	timestamps []int64,
	loc *time.Location,
	code, quote money.Currency,
	from, to time.Time,
) ([]feed.Quote, error) {
	var out []feed.Quote

	for i, closing := range closes {
		if i >= len(timestamps) || closing == nil || *closing <= 0 {
			continue
		}

		local := time.Unix(timestamps[i], 0).In(loc)

		date := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
		if date.Before(from) || date.After(to) {
			continue
		}

		value, err := money.ParseRate(closeText(*closing))
		if err != nil {
			return out, fmt.Errorf("read close %v: %w", *closing, err)
		}

		out = append(out, feed.Quote{Instrument: code, Quote: quote, Date: date, Value: value})
	}

	return out, nil
}

// closeText returns the decimal text of a close. Yahoo publishes float32 values, so the shortest
// float32 text (`349.51` for 349.510009765625) is the price; a text over 12 decimals falls back
// to 12 decimals (plan 2 D15).
func closeText(v float64) string {
	text := strconv.FormatFloat(float64(float32(v)), 'f', -1, 32)

	if i := strings.IndexByte(text, '.'); i >= 0 && len(text)-i-1 > 12 {
		text = strings.TrimSuffix(strings.TrimRight(strconv.FormatFloat(v, 'f', 12, 64), "0"), ".")
	}

	return text
}
