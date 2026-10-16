// Package page implements cursor pagination for list endpoints (ADR 005).
package page

import (
	"encoding/base64"
	"encoding/json/v2"
	"errors"
)

const (
	DefaultLimit = 50
	MaxLimit     = 200
)

var (
	ErrInvalidLimit  = errors.New("limit must be between 1 and 200")
	ErrInvalidCursor = errors.New("invalid cursor")
)

// Request asks for at most Limit rows after the row whose sort key is After.
type Request[K any] struct {
	After *K
	Limit int
}

// Limit returns DefaultLimit when requested is nil.
func Limit(requested *int) (int, error) {
	if requested == nil {
		return DefaultLimit, nil
	}
	if *requested < 1 || *requested > MaxLimit {
		return 0, ErrInvalidLimit
	}
	return *requested, nil
}

// EncodeCursor serializes the sort key of the last returned row.
func EncodeCursor(key any) (string, error) {
	b, err := json.Marshal(key)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// DecodeCursor fills key from a cursor produced by EncodeCursor with the same key type.
func DecodeCursor(cursor string, key any) error {
	b, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return ErrInvalidCursor
	}
	if err := json.Unmarshal(b, key, json.RejectUnknownMembers(true)); err != nil {
		return ErrInvalidCursor
	}
	return nil
}

// Trim takes the limit+1 rows a query fetched and reports whether a next page exists.
func Trim[T any](rows []T, limit int) (items []T, hasMore bool) {
	if len(rows) > limit {
		return rows[:limit], true
	}
	return rows, false
}

// Read parses the limit and cursor parameters of a list request; it returns ErrInvalidLimit
// or ErrInvalidCursor.
func Read[K any](limit *int, cursor *string) (Request[K], error) {
	n, err := Limit(limit)
	if err != nil {
		return Request[K]{}, err
	}
	r := Request[K]{Limit: n}
	if cursor != nil {
		var k K
		if err := DecodeCursor(*cursor, &k); err != nil {
			return Request[K]{}, err
		}
		r.After = &k
	}
	return r, nil
}

// Next encodes the key of the last row of a page; nil on the last page.
func Next[K any](k *K) (*string, error) {
	if k == nil {
		return nil, nil
	}
	c, err := EncodeCursor(k)
	if err != nil {
		return nil, err
	}
	return &c, nil
}
