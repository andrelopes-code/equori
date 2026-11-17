package yahoochart

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// sessionMargin is the wait after the end of the regular session before its bar is a close
// (A248 CQ2).
const sessionMargin = 30 * time.Minute

// chartAnswer is the answer of the chart endpoint.
type chartAnswer struct {
	Chart struct {
		Result []struct {
			Meta       chartMeta `json:"meta"`
			Timestamp  []int64   `json:"timestamp"`
			Indicators struct {
				Quote []series `json:"quote"`
			} `json:"indicators"`
		} `json:"result"`
	} `json:"chart"`
}

type chartMeta struct {
	Currency             string  `json:"currency"`
	ExchangeTimezoneName string  `json:"exchangeTimezoneName"`
	RegularMarketPrice   float64 `json:"regularMarketPrice"`
	RegularMarketTime    int64   `json:"regularMarketTime"`
	CurrentTradingPeriod struct {
		Regular struct {
			Start int64 `json:"start"`
			End   int64 `json:"end"`
		} `json:"regular"`
	} `json:"currentTradingPeriod"`
}

// series holds the daily bars of a quote. A series without volume or without the open, high and
// low keeps every close.
type series struct {
	Open   []*float64 `json:"open"`
	High   []*float64 `json:"high"`
	Low    []*float64 `json:"low"`
	Close  []*float64 `json:"close"`
	Volume []*float64 `json:"volume"`
}

// untraded reports whether bar i is a day without a trade: Yahoo repeats the last close with
// volume 0 and the open, high and low equal to it (B5P211 repeated 71.25 for 959 days).
func (s series) untraded(i int) bool {
	if i >= len(s.Volume) || s.Volume[i] == nil || *s.Volume[i] != 0 {
		return false
	}

	for _, v := range [][]*float64{s.Open, s.High, s.Low} {
		if i >= len(v) || v[i] == nil || *v[i] != *s.Close[i] {
			return false
		}
	}

	return true
}

func parse(
	body []byte,
	code, quote money.Currency,
	from, to, now time.Time,
) ([]feed.Quote, error) {
	var answer chartAnswer

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
		result.Indicators.Quote[0],
		result.Timestamp,
		loc,
		code,
		quote,
		from,
		to,
		now,
		result.Meta.CurrentTradingPeriod.Regular.End,
	)
}

func closeQuotes(
	bars series,
	timestamps []int64,
	loc *time.Location,
	code, quote money.Currency,
	from, to, now time.Time,
	sessionEnd int64,
) ([]feed.Quote, error) {
	var out []feed.Quote

	for i, closing := range bars.Close {
		if i >= len(timestamps) || closing == nil || *closing <= 0 || bars.untraded(i) {
			continue
		}

		date := localDate(time.Unix(timestamps[i], 0), loc)
		if date.Before(from) || date.After(to) || !finished(date, now, loc, sessionEnd) {
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

// finished reports whether the bar of date is a close at now: a bar of an earlier local date,
// or the bar of today once the session that ends on that date is over (A248 CQ2).
func finished(date, now time.Time, loc *time.Location, sessionEnd int64) bool {
	if date.Before(localDate(now, loc)) {
		return true
	}

	if sessionEnd == 0 {
		return false
	}

	end := time.Unix(sessionEnd, 0)

	return localDate(end, loc).Equal(date) && !now.Before(end.Add(sessionMargin))
}

// localDate returns the date of t in loc as midnight UTC, the form of a bar date.
func localDate(t time.Time, loc *time.Location) time.Time {
	local := t.In(loc)

	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
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
