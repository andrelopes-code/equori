package yahoochart

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// spotWorkers is the number of current quote requests in flight at once (A248 CQ8).
const spotWorkers = 8

// spotResult is the outcome of the request of one instrument: a quote, an error, or neither.
type spotResult struct {
	quote *feed.SpotQuote
	err   error
}

// Current returns the current quote of each instrument of ins that has a symbol, in the order of
// ins. A 404 answer has no quote for its instrument, a 429 answer ends the call with the quotes
// read and the 429 error alone, and any other failure is a ScopeError joined into the returned
// error (A248 CQ8).
func (s Source) Current(ctx context.Context, ins []feed.Instrument) ([]feed.SpotQuote, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var (
		results = make([]spotResult, len(ins))
		slots   = make(chan struct{}, spotWorkers)
		wg      sync.WaitGroup
	)

	for i, in := range ins {
		symbol, ok := s.Symbol(in)
		if !ok {
			continue
		}

		slots <- struct{}{}

		wg.Go(func() {
			defer func() { <-slots }()

			results[i] = s.currentResult(ctx, in, symbol)
			if feed.RateLimited(results[i].err) {
				cancel()
			}
		})
	}

	wg.Wait()

	return collectSpot(results)
}

func (s Source) currentResult(ctx context.Context, in feed.Instrument, symbol string) spotResult {
	quote, err := s.currentQuote(ctx, in, symbol)
	if err != nil && !feed.RateLimited(err) {
		err = &feed.ScopeError{Key: "instrument", Value: string(in.Code), Err: err}
	}

	return spotResult{quote: quote, err: err}
}

func (s Source) currentQuote(
	ctx context.Context,
	in feed.Instrument,
	symbol string,
) (*feed.SpotQuote, error) {
	endpoint := fmt.Sprintf("%s/%s?range=1d&interval=1d", s.baseURL, url.PathEscape(symbol))

	body, err := feed.Get(ctx, s.client, endpoint)
	if errors.Is(err, feed.ErrNoData) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return parseSpot(body, in.Code, quoteOf(in), s.now())
}

func parseSpot(body []byte, code, quote money.Currency, now time.Time) (*feed.SpotQuote, error) {
	var answer chartAnswer

	if err := json.Unmarshal(body, &answer); err != nil {
		return nil, fmt.Errorf("decode Yahoo chart: %w", err)
	}

	if len(answer.Chart.Result) == 0 {
		return nil, nil
	}

	meta := answer.Chart.Result[0].Meta
	if meta.RegularMarketPrice <= 0 || meta.RegularMarketTime == 0 {
		return nil, nil
	}

	if meta.Currency != string(quote) {
		return nil, fmt.Errorf("quoted in %s, want %s", meta.Currency, quote)
	}

	loc, err := time.LoadLocation(meta.ExchangeTimezoneName)
	if err != nil {
		return nil, fmt.Errorf("load exchange time zone %q: %w", meta.ExchangeTimezoneName, err)
	}

	value, err := money.ParseRate(closeText(meta.RegularMarketPrice))
	if err != nil {
		return nil, fmt.Errorf("read price %v: %w", meta.RegularMarketPrice, err)
	}

	last := time.Unix(meta.RegularMarketTime, 0).UTC()
	period := meta.CurrentTradingPeriod.Regular

	return &feed.SpotQuote{
		Instrument: code,
		Quote:      quote,
		Value:      value,
		At:         last,
		Date:       localDate(last, loc),
		Open: period.Start != 0 &&
			!now.Before(time.Unix(period.Start, 0)) &&
			now.Before(time.Unix(period.End, 0)),
	}, nil
}

// collectSpot returns the quotes of results in order. A 429 result returns the quotes read and
// its error alone.
func collectSpot(results []spotResult) ([]feed.SpotQuote, error) {
	var (
		out  []feed.SpotQuote
		errs []error
	)

	for _, r := range results {
		if feed.RateLimited(r.err) {
			return out, r.err
		}

		if r.err != nil {
			errs = append(errs, r.err)
		}

		if r.quote != nil {
			out = append(out, *r.quote)
		}
	}

	return out, errors.Join(errs...)
}
