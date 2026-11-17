package coinbase

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Current returns the last trade of the product of each crypto instrument of ins that has a
// quote currency, in the order of ins. A refused or unknown product, or one with no trade, has no
// quote. A 429 answer ends the call with the quotes read and the 429 error alone; any other
// failure is a ScopeError joined into the returned error (A248 CQ9).
func (s Source) Current(ctx context.Context, ins []feed.Instrument) ([]feed.SpotQuote, error) {
	var (
		out  []feed.SpotQuote
		errs []error
	)

	for _, in := range ins {
		if in.Type != "crypto" || in.QuoteCurrency == "" {
			continue
		}

		quote, err := s.currentQuote(ctx, in)
		if rateLimited(err) {
			return out, err
		}

		if err != nil {
			errs = append(
				errs,
				&feed.ScopeError{Key: "instrument", Value: string(in.Code), Err: err},
			)
		}

		if quote != nil {
			out = append(out, *quote)
		}
	}

	return out, errors.Join(errs...)
}

func (s Source) currentQuote(ctx context.Context, in feed.Instrument) (*feed.SpotQuote, error) {
	url := fmt.Sprintf("%s/products/%s-%s/ticker?limit=1", s.baseURL, in.Code, in.QuoteCurrency)

	body, err := feed.Get(ctx, s.client, url)

	var status *feed.StatusError
	if errors.Is(err, feed.ErrNoData) ||
		(errors.As(err, &status) && status.Code == http.StatusBadRequest) {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("fetch Coinbase ticker: %w", err)
	}

	return parseTicker(body, in.Code, in.QuoteCurrency)
}

func parseTicker(body []byte, code, quote money.Currency) (*feed.SpotQuote, error) {
	var answer struct {
		Trades []struct {
			Price string `json:"price"`
			Time  string `json:"time"`
		} `json:"trades"`
	}

	if err := json.Unmarshal(body, &answer); err != nil {
		return nil, fmt.Errorf("decode Coinbase ticker: %w", err)
	}

	if len(answer.Trades) == 0 {
		return nil, nil
	}

	trade := answer.Trades[0]

	last, err := time.Parse(time.RFC3339Nano, trade.Time)
	if err != nil {
		return nil, fmt.Errorf("read trade time %q: %w", trade.Time, err)
	}

	value, err := money.ParseRate(trade.Price)
	if err != nil {
		return nil, fmt.Errorf("read trade price %q: %w", trade.Price, err)
	}

	last = last.UTC()

	// A crypto market never closes: its date is the UTC day of the trade.
	return &feed.SpotQuote{
		Instrument: code,
		Quote:      quote,
		Value:      value,
		At:         last,
		Date:       last.Truncate(24 * time.Hour),
		Open:       true,
	}, nil
}

func rateLimited(err error) bool {
	var status *feed.StatusError

	return errors.As(err, &status) && status.Code == http.StatusTooManyRequests
}
