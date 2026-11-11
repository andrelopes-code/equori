package coinbase

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// windowDays is the last day of a request after its first: the API answers at most 300 candles.
const windowDays = 299

// Source reads the daily candles of the Coinbase public market API (A222 MQ17).
type Source struct {
	client  *http.Client
	baseURL string
	quotes  *quotes
	list    *feed.ListCache
}

// quotes maps a code to its quote currency (plan 2 D12).
type quotes struct {
	mu   sync.Mutex
	byID map[money.Currency]money.Currency
}

// New returns a Source that reads the products under baseURL.
func New(c *http.Client, baseURL string) Source {
	return Source{
		client:  c,
		baseURL: baseURL,
		quotes:  &quotes{byID: map[money.Currency]money.Currency{}},
		list:    feed.NewListCache(time.Now),
	}
}

func (Source) ID() string { return "coinbase" }

// Codes returns the crypto instruments with a quote currency, and records the quote of each.
func (s Source) Codes(ins []feed.Instrument) []money.Currency {
	s.quotes.mu.Lock()
	defer s.quotes.mu.Unlock()

	var out []money.Currency

	for _, in := range ins {
		if in.Type == "crypto" && in.QuoteCurrency != "" {
			s.quotes.byID[in.Code] = in.QuoteCurrency
			out = append(out, in.Code)
		}
	}

	return out
}

// Fetch returns the close of each day in [from, to] for each code. A product the API refuses
// (400 or 404) has no data; any other failure is a ScopeError joined into the returned error
// while the next code still runs.
func (s Source) Fetch(ctx context.Context, codes []money.Currency, from, to time.Time) ([]feed.Quote, error) {
	var (
		out  []feed.Quote
		errs []error
	)

	for _, code := range codes {
		s.quotes.mu.Lock()
		quote, ok := s.quotes.byID[code]
		s.quotes.mu.Unlock()

		if !ok {
			continue
		}

		got, err := s.fetchCode(ctx, code, quote, from, to)
		out = append(out, got...)

		if err != nil {
			errs = append(errs, &feed.ScopeError{Key: "instrument", Value: string(code), Err: err})
		}
	}

	return out, errors.Join(errs...)
}

// Search matches the enabled spot products; the list is read at most once in 24 hours (plan 3 D6).
func (s Source) Search(ctx context.Context, query string, limit int) ([]feed.Listing, error) {
	list, ok := s.list.Fresh()
	if !ok {
		var err error

		if list, err = s.readProducts(ctx); err != nil {
			return nil, err
		}

		s.list.Set(list)
	}

	return feed.MatchListings(list, query, limit), nil
}

func (s Source) readProducts(ctx context.Context) ([]feed.Listing, error) {
	body, err := feed.Get(ctx, s.client, s.baseURL+"/products?product_type=SPOT")
	if err != nil {
		return nil, fmt.Errorf("fetch Coinbase products: %w", err)
	}

	var answer struct {
		Products []struct {
			ID         string         `json:"product_id"`
			Base       money.Currency `json:"base_currency_id"`
			Quote      money.Currency `json:"quote_currency_id"`
			Name       string         `json:"base_name"`
			IsDisabled bool           `json:"is_disabled"`
		} `json:"products"`
	}
	if err := json.Unmarshal(body, &answer); err != nil {
		return nil, fmt.Errorf("decode Coinbase products: %w", err)
	}

	list := make([]feed.Listing, 0, len(answer.Products))

	for _, p := range answer.Products {
		if p.IsDisabled {
			continue
		}

		list = append(list, feed.Listing{
			Code: p.Base, Name: p.Name, Type: "crypto", QuoteCurrency: p.Quote, Symbol: p.ID,
		})
	}

	return list, nil
}

func (s Source) fetchCode(
	ctx context.Context, code, quote money.Currency, from, to time.Time,
) ([]feed.Quote, error) {
	var out []feed.Quote

	for start := from; !start.After(to); {
		end := start.AddDate(0, 0, windowDays)
		if end.After(to) {
			end = to
		}

		url := fmt.Sprintf("%s/products/%s-%s/candles?granularity=ONE_DAY&start=%d&end=%d",
			s.baseURL, code, quote, start.Unix(), end.Unix())

		body, err := feed.Get(ctx, s.client, url)

		var status *feed.StatusError
		if errors.Is(err, feed.ErrNoData) || (errors.As(err, &status) && status.Code == http.StatusBadRequest) {
			return out, nil
		}

		if err != nil {
			return out, fmt.Errorf("fetch Coinbase candles: %w", err)
		}

		got, err := parse(body, code, quote, from, to)
		out = append(out, got...)

		if err != nil {
			return out, err
		}

		start = end.AddDate(0, 0, 1)
	}

	return out, nil
}

func parse(body []byte, code, quote money.Currency, from, to time.Time) ([]feed.Quote, error) {
	var answer struct {
		Candles []struct {
			Start string `json:"start"`
			Close string `json:"close"`
		} `json:"candles"`
	}

	if err := json.Unmarshal(body, &answer); err != nil {
		return nil, fmt.Errorf("decode Coinbase candles: %w", err)
	}

	var out []feed.Quote

	for _, c := range answer.Candles {
		secs, err := strconv.ParseInt(c.Start, 10, 64)
		if err != nil {
			return out, fmt.Errorf("read candle start %q: %w", c.Start, err)
		}

		date := time.Unix(secs, 0).UTC().Truncate(24 * time.Hour)
		if date.Before(from) || date.After(to) {
			continue
		}

		value, err := money.ParseRate(c.Close)
		if err != nil {
			return out, fmt.Errorf("read candle close %q: %w", c.Close, err)
		}

		out = append(out, feed.Quote{Instrument: code, Quote: quote, Date: date, Value: value})
	}

	// The API answers newest first.
	slices.SortFunc(out, func(a, b feed.Quote) int { return a.Date.Compare(b.Date) })

	return out, nil
}
