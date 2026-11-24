// Package feed reads public price sources and returns Market data quotes: the
// anti-corruption layer of chapter 4, 4.2 (P8 amendment A62).
package feed

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ErrNoData means the source has nothing for the request (404 or an empty file).
var ErrNoData = errors.New("no data")

// maxResponseBytes bounds one answer; a COTAHIST daily ZIP is about 0.7 MiB, a B3 consolidated
// trades file about 6 MiB.
const maxResponseBytes = 16 << 20

// maxErrorBodyBytes bounds the part of an error answer that a StatusError keeps.
const maxErrorBodyBytes = 512

// maxDownloadBytes bounds an answer read through Download: a COTAHIST year file had 102 MB in
// 2026 (A222 MQ13).
const maxDownloadBytes = 256 << 20

type Quote struct {
	Instrument money.Currency
	Quote      money.Currency
	Date       time.Time
	Value      money.Rate
	// Source is the source whose file holds the quote; empty means the reading source (A222 MQ12).
	Source string
}

// Instrument is a Market data instrument as a source sees it.
type Instrument struct {
	Code          money.Currency
	Type          string
	Exchange      string
	QuoteCurrency money.Currency
	// Symbols maps a source ID to the symbol a member set for it (A222 MQ20).
	Symbols map[string]string
}

// SymbolOverride is a source that reads Instrument.Symbols (A222 MQ20).
type SymbolOverride interface {
	// Symbol returns the symbol the source requests for in, false when it requests none.
	Symbol(in Instrument) (string, bool)
}

// Source reads quotes from one public price source.
type Source interface {
	ID() string
	// Codes returns the codes of ins the source quotes.
	Codes(ins []Instrument) []money.Currency
	// Fetch returns the quotes read before a failure together with the failure.
	Fetch(ctx context.Context, codes []money.Currency, from, to time.Time) ([]Quote, error)
}

// DayArchive is a Source that publishes one file per day and keeps them since a day: a hole is asked
// day by day, never by year (A265 PH4).
type DayArchive interface {
	DayArchiveSince() time.Time
}

// Witnessed is a Source whose files list every security that traded. Witness traded at every session:
// a session with its quote and without the one of another code it quotes had no trade of that code
// (A265 PH5).
type Witnessed interface {
	Witness() money.Currency
}

// ScopeError names the part of a fetch (a code or a day) that failed.
type ScopeError struct {
	Key, Value string
	Err        error
}

func (e *ScopeError) Error() string { return e.Key + " " + e.Value + ": " + e.Err.Error() }

func (e *ScopeError) Unwrap() error { return e.Err }

// StatusError is an answer other than 200 and 404. Body holds the first bytes of the answer.
type StatusError struct {
	Code int
	Body string
}

func (e *StatusError) Error() string { return fmt.Sprintf("status %d", e.Code) }

// RateLimited reports whether err holds a 429 answer: the source asked to slow down.
func RateLimited(err error) bool {
	var status *StatusError

	return errors.As(err, &status) && status.Code == http.StatusTooManyRequests
}

// Incremental reports whether [from, to] spans at most 31 days, the tick's window (A222 MQ14).
func Incremental(from, to time.Time) bool { return !from.Before(to.AddDate(0, 0, -31)) }

// Conditional remembers the Last-Modified of the answers of one source by key (A222 MQ14).
type Conditional struct {
	mu   sync.Mutex
	seen map[string]string
}

func NewConditional() *Conditional { return &Conditional{seen: map[string]string{}} }

// Since returns the Last-Modified remembered for key, or "".
func (c *Conditional) Since(key string) string {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.seen[key]
}

// Remember stores lastModified for key; an empty value removes the key.
func (c *Conditional) Remember(key, lastModified string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if lastModified == "" {
		delete(c.seen, key)

		return
	}

	c.seen[key] = lastModified
}

// Get returns the body of url; a 404 answer returns ErrNoData.
func Get(ctx context.Context, c *http.Client, url string) ([]byte, error) {
	body, _, err := GetSince(ctx, c, url, "")

	return body, err
}

// GetSince is Get with If-Modified-Since: since when since is not empty. A 304 answer returns
// ErrNoData. It returns the body and the Last-Modified of the answer.
func GetSince(ctx context.Context, c *http.Client, url, since string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", err
	}

	if since != "" {
		req.Header.Set("If-Modified-Since", since)
	}

	resp, err := c.Do(req)
	if err != nil {
		return nil, "", err
	}

	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusNotModified {
		return nil, "", ErrNoData
	}

	if resp.StatusCode != http.StatusOK {
		head, _ := io.ReadAll(io.LimitReader(resp.Body, maxErrorBodyBytes))

		return nil, "", &StatusError{Code: resp.StatusCode, Body: string(head)}
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return nil, "", err
	}

	return body, resp.Header.Get("Last-Modified"), nil
}

// Download streams the body of url to a file under os.TempDir, passes it to read and removes it.
// A 404 answer returns ErrNoData; an answer over 256 MiB is an error.
func Download(
	ctx context.Context,
	c *http.Client,
	url string,
	read func(f *os.File, size int64) error,
) error {
	_, err := DownloadSince(ctx, c, url, "", read)

	return err
}

// DownloadSince is Download with If-Modified-Since: since when since is not empty. A 304 answer
// returns ErrNoData. It returns the Last-Modified of the answer.
func DownloadSince(
	ctx context.Context,
	c *http.Client,
	url, since string,
	read func(f *os.File, size int64) error,
) (string, error) {
	return download(ctx, c, url, since, maxDownloadBytes, read)
}

func download(
	ctx context.Context,
	c *http.Client,
	url, since string,
	limit int64,
	read func(f *os.File, size int64) error,
) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}

	if since != "" {
		req.Header.Set("If-Modified-Since", since)
	}

	resp, err := c.Do(req)
	if err != nil {
		return "", err
	}

	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusNotModified {
		return "", ErrNoData
	}

	if resp.StatusCode != http.StatusOK {
		return "", &StatusError{Code: resp.StatusCode}
	}

	f, err := os.CreateTemp("", "equori-download-*")
	if err != nil {
		return "", err
	}

	defer func() {
		_ = f.Close()
		_ = os.Remove(f.Name())
	}()

	size, err := io.Copy(f, io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return "", err
	}

	if size > limit {
		return "", fmt.Errorf("answer over %d bytes", limit)
	}

	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return "", err
	}

	return resp.Header.Get("Last-Modified"), read(f, size)
}
