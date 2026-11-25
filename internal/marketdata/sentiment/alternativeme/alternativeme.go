// Package alternativeme reads the Crypto Fear & Greed Index of alternative.me: one value a day since
// 2018-02-01, dated at midnight UTC. The terms ask for the attribution beside the value.
package alternativeme

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/sentiment"
)

const (
	id       = "alternative_me"
	greatest = 100
	day      = 24 * time.Hour
)

type Source struct {
	hc   *http.Client
	base string
}

// New reads the index API at base.
func New(hc *http.Client, base string) Source {
	return Source{hc: hc, base: base}
}

func (s Source) ID() string    { return id }
func (s Source) Index() string { return "crypto_fear_greed" }

type row struct {
	Value     string `json:"value"`
	Timestamp string `json:"timestamp"`
}

// Fetch asks for the newest days values; the API returns every value for a limit of 0.
func (s Source) Fetch(ctx context.Context, days int) ([]sentiment.Value, error) {
	body, err := feed.Get(ctx, s.hc, s.base+"/fng/?limit="+strconv.Itoa(days))
	if err != nil {
		return nil, fmt.Errorf("%s: %w", id, err)
	}

	var doc struct {
		Data []row `json:"data"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("%s: decode: %w", id, err)
	}

	if len(doc.Data) == 0 {
		return nil, fmt.Errorf("%s: %w", id, feed.ErrNoData)
	}

	out := make([]sentiment.Value, len(doc.Data))
	seen := make(map[time.Time]bool, len(doc.Data))

	for i, r := range doc.Data {
		v, err := r.value()
		if err != nil {
			return nil, fmt.Errorf("%s: %w", id, err)
		}

		if seen[v.Date] {
			return nil, fmt.Errorf("%s: %s is repeated", id, v.Date.Format(time.DateOnly))
		}

		seen[v.Date] = true
		out[i] = v
	}

	return out, nil
}

func (r row) value() (sentiment.Value, error) {
	seconds, err := strconv.ParseInt(r.Timestamp, 10, 64)
	if err != nil {
		return sentiment.Value{}, fmt.Errorf("timestamp %q: %w", r.Timestamp, err)
	}

	value, err := strconv.Atoi(r.Value)
	if err != nil {
		return sentiment.Value{}, fmt.Errorf("value %q: %w", r.Value, err)
	}

	if value < 0 || value > greatest {
		return sentiment.Value{}, fmt.Errorf("value %d is outside 0 to %d", value, greatest)
	}

	return sentiment.Value{Date: time.Unix(seconds, 0).UTC().Truncate(day), Value: value}, nil
}
