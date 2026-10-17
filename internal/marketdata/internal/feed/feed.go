// Package feed reads public price sources and returns Market data quotes: the
// anti-corruption layer of chapter 4, 4.2 (P8 amendment A62).
package feed

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ErrNoData means the source has nothing for the request (404 or an empty file).
var ErrNoData = errors.New("no data")

// maxResponseBytes bounds one answer; a COTAHIST daily ZIP is about 0.7 MiB.
const maxResponseBytes = 16 << 20

type Quote struct {
	Instrument money.Currency
	Quote      money.Currency
	Date       time.Time
	Value      money.Rate
}

func get(ctx context.Context, c *http.Client, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrNoData
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
}
