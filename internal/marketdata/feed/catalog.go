package feed

import (
	"context"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// listFreshFor is how long Fresh returns a list.
const listFreshFor = 24 * time.Hour

// Listing is one instrument a source can quote (A222 MQ28).
type Listing struct {
	Code money.Currency
	Name string
	// Type is an instrument type, or empty when the source states none.
	Type          string
	Exchange      string
	QuoteCurrency money.Currency
	// Symbol is what the source requests for the code, or empty.
	Symbol string
}

// Catalog is a source that lists the instruments it can quote (A222 MQ28).
type Catalog interface {
	// Search returns at most limit listings whose code or name contains query.
	Search(ctx context.Context, query string, limit int) ([]Listing, error)
}

// ListCache holds the listings of one source and when they were set (A222 MQ28).
type ListCache struct {
	mu   sync.Mutex
	now  func() time.Time
	at   time.Time
	list []Listing
}

func NewListCache(now func() time.Time) *ListCache { return &ListCache{now: now} }

// MatchListings returns at most limit listings of all whose code or name contains query, compared
// in lower case and, for the code, without punctuation or spaces ("NTN-B" finds NTNB.20300815);
// the listings whose code starts with query come first.
func MatchListings(all []Listing, query string, limit int) []Listing {
	query = strings.ToLower(query)
	key := codeKey(query)

	var first, rest []Listing

	for _, l := range all {
		code := codeKey(string(l.Code))

		switch {
		case key != "" && strings.HasPrefix(code, key):
			first = append(first, l)
		case key != "" && strings.Contains(code, key),
			strings.Contains(strings.ToLower(l.Name), query):
			rest = append(rest, l)
		}
	}

	out := append(first, rest...)
	if len(out) > limit {
		out = out[:limit]
	}

	return out
}

// Set stores list as read now.
func (c *ListCache) Set(list []Listing) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.at, c.list = c.now(), list
}

// Fresh returns the list set in the last 24 hours; false when none was.
func (c *ListCache) Fresh() ([]Listing, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.list == nil || c.now().Sub(c.at) >= listFreshFor {
		return nil, false
	}

	return c.list, true
}

// Last returns the list set last, however old.
func (c *ListCache) Last() []Listing {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.list
}

// codeKey is s in lower case with only its letters and digits.
func codeKey(s string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			return unicode.ToLower(r)
		}

		return -1
	}, s)
}
