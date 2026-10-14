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
