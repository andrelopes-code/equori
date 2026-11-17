package marketdata

import (
	"cmp"
	"errors"
	"math"
	"net/http"
	"sync"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	spotOpenFresh   = time.Minute
	spotClosedFresh = 15 * time.Minute
	spotRetry       = time.Minute
	spotPause       = 15 * time.Minute
)

// spotKey names the current quote one source holds for one instrument.
type spotKey struct {
	source     string
	instrument money.Currency
}

// spotEntry is the answer of a source for one instrument: a quote, or a failure when none came.
type spotEntry struct {
	quote  feed.SpotQuote
	at     time.Time
	failed bool
}

// spotRun is the state of a source (A248 CQ25): at is its last request that returned no error,
// err the message of its last failure.
type spotRun struct {
	at  time.Time
	err string
}

// spotClaim is what one WarmCurrent call asks of one source.
type spotClaim struct {
	ask  []feed.Instrument
	done chan struct{}
	// wait holds the requests of earlier calls that cover instruments the call needs.
	wait []<-chan struct{}
}

// spotCache holds the current quotes of the sources, guarded by mu.
type spotCache struct {
	mu      sync.Mutex
	entries map[spotKey]spotEntry
	flight  map[spotKey]chan struct{}
	paused  map[string]time.Time
	runs    map[string]spotRun
}

func newSpotCache() *spotCache {
	return &spotCache{
		entries: make(map[spotKey]spotEntry),
		flight:  make(map[spotKey]chan struct{}),
		paused:  make(map[string]time.Time),
		runs:    make(map[string]spotRun),
	}
}

// claim selects the instruments of ins that source must be asked at now and marks them in
// flight; a paused source claims nothing.
func (c *spotCache) claim(source string, ins []feed.Instrument, now time.Time) spotClaim {
	c.mu.Lock()
	defer c.mu.Unlock()

	var out spotClaim

	if now.Before(c.paused[source]) {
		return out
	}

	for _, in := range ins {
		key := spotKey{source: source, instrument: in.Code}

		if done, ok := c.flight[key]; ok {
			out.wait = append(out.wait, done)
			continue
		}

		if e, ok := c.entries[key]; ok && !e.expired(now) {
			continue
		}

		out.ask = append(out.ask, in)
	}

	if len(out.ask) == 0 {
		return out
	}

	out.done = make(chan struct{})
	for _, in := range out.ask {
		c.flight[spotKey{source: source, instrument: in.Code}] = out.done
	}

	return out
}

// finish stores the outcome of the request a claim started and releases its instruments.
func (c *spotCache) finish(
	source string,
	claim spotClaim,
	quotes []feed.SpotQuote,
	err error,
	now time.Time,
) {
	c.mu.Lock()
	defer c.mu.Unlock()

	for _, in := range claim.ask {
		key := spotKey{source: source, instrument: in.Code}
		c.entries[key] = spotEntry{at: now, failed: true}

		delete(c.flight, key)
	}

	for _, q := range quotes {
		c.entries[spotKey{source: source, instrument: q.Instrument}] = spotEntry{quote: q, at: now}
	}

	var status *feed.StatusError
	if errors.As(err, &status) && status.Code == http.StatusTooManyRequests {
		c.paused[source] = now.Add(spotPause)
	}

	run := c.runs[source]
	if err == nil {
		run = spotRun{at: now}
	} else {
		run.err = err.Error()
	}

	c.runs[source] = run

	close(claim.done)
}

// fresh returns the fresh entry of the pair (from, to), else of (to, from) with inverse set. With
// two sources the lower priority wins.
func (c *spotCache) fresh(
	from, to money.Currency,
	now time.Time,
	unofficial domain.UnofficialSources,
) (entry spotEntry, source string, inverse, ok bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if entry, source, ok = c.best(from, to, now, unofficial); ok {
		return entry, source, false, true
	}

	entry, source, ok = c.best(to, from, now, unofficial)

	return entry, source, true, ok
}

// best returns the fresh entry of the pair with the lowest priority; the caller holds mu.
func (c *spotCache) best(
	instrument, quote money.Currency,
	now time.Time,
	unofficial domain.UnofficialSources,
) (best spotEntry, source string, found bool) {
	rank := int16(math.MaxInt16)

	for key, e := range c.entries {
		if e.failed || e.expired(now) || e.quote.Instrument != instrument ||
			e.quote.Quote != quote {
			continue
		}

		r, err := domain.Priority(key.source, unofficial)
		if err != nil {
			r = math.MaxInt16
		}

		if !found || r < rank || (r == rank && cmp.Less(key.source, source)) {
			best, source, rank, found = e, key.source, r, true
		}
	}

	return best, source, found
}

// expired reports whether the entry is past its freshness; a failed entry waits spotRetry.
func (e spotEntry) expired(now time.Time) bool {
	window := spotClosedFresh

	switch {
	case e.failed:
		window = spotRetry
	case e.quote.Open:
		window = spotOpenFresh
	}

	return now.Sub(e.at) >= window
}
