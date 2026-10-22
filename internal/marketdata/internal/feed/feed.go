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

// Instrument is a Market data instrument as a source sees it.
type Instrument struct {
	Code          money.Currency
	Type          string
	Exchange      string
	QuoteCurrency money.Currency
}

// Source reads quotes from one public price source.
type Source interface {
	ID() string
	// Codes returns the codes of ins the source quotes.
	Codes(ins []Instrument) []money.Currency
	// Fetch returns the quotes read before a failure together with the failure.
	Fetch(ctx context.Context, codes []money.Currency, from, to time.Time) ([]Quote, error)
}

// ScopeError names the part of a fetch (a code or a day) that failed.
type ScopeError struct {
	Key, Value string
	Err        error
}

func (e *ScopeError) Error() string { return e.Key + " " + e.Value + ": " + e.Err.Error() }

func (e *ScopeError) Unwrap() error { return e.Err }

// Get returns the body of url; a 404 answer returns ErrNoData.
func Get(ctx context.Context, c *http.Client, url string) ([]byte, error) {
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
