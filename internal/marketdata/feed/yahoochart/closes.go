package yahoochart

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
)

// Close is the close of one session of a symbol, a decimal, and the close with its distributions
// reinvested, empty when the chart states none. The last one is comparable only with the other
// adjusted closes of one answer: each distribution scales every earlier one.
type Close struct {
	Date            time.Time
	Value, Adjusted string
}

// adjusted holds the closes of the bars with the distributions reinvested.
type adjusted struct {
	Close []*float64 `json:"adjclose"`
}

// Closes returns the finished closes of symbol in [from, to], oldest first, as Yahoo publishes
// them: a split divides the closes before it, so their ratios are the returns of the holder. A bar
// of an index holds no volume, so none is skipped for it.
func Closes(
	ctx context.Context,
	c *http.Client,
	baseURL, symbol string,
	from, to, now time.Time,
) ([]Close, error) {
	endpoint := fmt.Sprintf("%s/%s?period1=%d&period2=%d&interval=1d&events=div",
		baseURL, url.PathEscape(symbol), from.Unix(), to.AddDate(0, 0, 1).Unix())

	body, err := feed.Get(ctx, c, endpoint)
	if errors.Is(err, feed.ErrNoData) || noBars(err) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return parseCloses(body, from, to, now)
}

func parseCloses(body []byte, from, to, now time.Time) ([]Close, error) {
	var answer chartAnswer
	if err := json.Unmarshal(body, &answer); err != nil {
		return nil, fmt.Errorf("decode Yahoo chart: %w", err)
	}

	if len(answer.Chart.Result) == 0 || len(answer.Chart.Result[0].Indicators.Quote) == 0 {
		return nil, nil
	}

	result := answer.Chart.Result[0]

	loc, err := time.LoadLocation(result.Meta.ExchangeTimezoneName)
	if err != nil {
		return nil, fmt.Errorf("load time zone %q: %w", result.Meta.ExchangeTimezoneName, err)
	}

	var scaled []*float64
	if len(result.Indicators.Adjusted) > 0 {
		scaled = result.Indicators.Adjusted[0].Close
	}

	var out []Close

	for i, closing := range result.Indicators.Quote[0].Close {
		if i >= len(result.Timestamp) || closing == nil || *closing <= 0 {
			continue
		}

		date := localDate(time.Unix(result.Timestamp[i], 0), loc)
		if date.Before(from) || date.After(to) ||
			!finished(date, now, loc, result.Meta.CurrentTradingPeriod.Regular.End) {
			continue
		}

		one := Close{Date: date, Value: closeText(*closing)}
		if i < len(scaled) && scaled[i] != nil && *scaled[i] > 0 {
			one.Adjusted = strconv.FormatFloat(*scaled[i], 'f', 8, 64)
		}

		// Yahoo can repeat the last session as a live bar.
		if n := len(out); n > 0 && out[n-1].Date.Equal(date) {
			out[n-1] = one
			continue
		}

		out = append(out, one)
	}

	return out, nil
}
