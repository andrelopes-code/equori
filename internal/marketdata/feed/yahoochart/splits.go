package yahoochart

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Splits returns the splits of each security of ins that has a symbol, one request per symbol. A 429
// answer ends it; any other failure is a ScopeError while the next one still runs.
func (s Source) Splits(ctx context.Context, ins []feed.Instrument) ([]feed.Split, error) {
	var (
		out  []feed.Split
		errs []error
	)

	for _, in := range ins {
		symbol, ok := s.Symbol(in)
		if !ok || in.Type == "currency" || in.Type == "crypto" {
			continue
		}

		got, err := s.splitsOf(ctx, in.Code, symbol)
		out = append(out, got...)

		var status *feed.StatusError
		if errors.As(err, &status) && status.Code == http.StatusTooManyRequests {
			return out, errors.Join(append(errs, err)...)
		}

		if err != nil {
			errs = append(
				errs,
				&feed.ScopeError{Key: "instrument", Value: string(in.Code), Err: err},
			)
		}
	}

	return out, errors.Join(errs...)
}

func (s Source) splitsOf(
	ctx context.Context,
	code money.Currency,
	symbol string,
) ([]feed.Split, error) {
	endpoint := fmt.Sprintf("%s/%s?period1=0&period2=%d&interval=3mo&events=split",
		s.baseURL, url.PathEscape(symbol), s.now().Unix())

	body, err := feed.Get(ctx, s.client, endpoint)
	if errors.Is(err, feed.ErrNoData) || noBars(err) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	var answer chartAnswer
	if err := json.Unmarshal(body, &answer); err != nil {
		return nil, fmt.Errorf("decode Yahoo chart: %w", err)
	}

	if len(answer.Chart.Result) == 0 {
		return nil, nil
	}

	result := answer.Chart.Result[0]

	loc, err := time.LoadLocation(result.Meta.ExchangeTimezoneName)
	if err != nil {
		return nil, fmt.Errorf("load time zone %q: %w", result.Meta.ExchangeTimezoneName, err)
	}

	var out []feed.Split

	for _, e := range result.Events.Splits {
		if e.Numerator <= 0 || e.Denominator <= 0 {
			continue
		}

		out = append(out, feed.Split{
			Instrument: code,
			Date:       localDate(time.Unix(e.Date, 0), loc),
			Ratio:      new(big.Rat).Quo(decimal(e.Numerator), decimal(e.Denominator)),
		})
	}

	return out, nil
}

// decimal is the shortest decimal of v, so that 1.029647 is 1029647/1000000.
func decimal(v float64) *big.Rat {
	r, _ := new(big.Rat).SetString(strconv.FormatFloat(v, 'f', -1, 64))

	return r
}
