package domain

import (
	"crypto/rand"
	"encoding/base32"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

// AccessTokenDays are the lifetimes a token can be created with (design 2026-10-26 X7).
var AccessTokenDays = []int{30, 90, 365}

const (
	ScopeRead  = "read"
	ScopeWrite = "write"
	// AccessTokenPrefix marks the text of a personal access token (X6).
	AccessTokenPrefix = "eqt_"
	maxTokenName      = 80
)

// AccessToken opens /mcp for one user. It is persisted by TokenHash only; the text is shown once.
type AccessToken struct {
	ID         uuid.UUID
	UserID     int64
	Name       string
	Scope      string
	TokenHash  []byte
	CreatedAt  time.Time
	ExpiresAt  time.Time
	LastUsedAt *time.Time
}

// NewAccessToken returns the token text, eqt_ and 32 random bytes in unpadded base32, and its record.
func NewAccessToken(userID int64, name, scope string, days int, now time.Time) (string, AccessToken, error) {
	name = strings.TrimSpace(name)
	switch {
	case name == "" || utf8.RuneCountInString(name) > maxTokenName:
		return "", AccessToken{}, &FieldError{Field: "name", Message: "must have between 1 and 80 characters"}
	case scope != ScopeRead && scope != ScopeWrite:
		return "", AccessToken{}, &FieldError{Field: "scope", Message: "must be read or write"}
	case !slices.Contains(AccessTokenDays, days):
		return "", AccessToken{}, &FieldError{Field: "expires_in_days", Message: "must be 30, 90 or 365"}
	}
	b := make([]byte, 32)
	_, _ = rand.Read(b) // crypto/rand.Read never returns an error since Go 1.24.
	text := AccessTokenPrefix + base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b)
	return text, AccessToken{
		ID: uuid.New(), UserID: userID, Name: name, Scope: scope, TokenHash: HashToken(text),
		CreatedAt: now, ExpiresAt: now.AddDate(0, 0, days),
	}, nil
}
