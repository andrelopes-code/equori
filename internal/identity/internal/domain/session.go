package domain

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"time"
)

const SessionTTL = 30 * 24 * time.Hour

// Session is persisted by TokenHash only; the token itself exists only in the client cookie.
type Session struct {
	TokenHash []byte
	UserID    int64
	CreatedAt time.Time
	ExpiresAt time.Time
}

func NewSession(userID int64, now time.Time) (token string, s Session) {
	b := make([]byte, 32)
	_, _ = rand.Read(b) // crypto/rand.Read never returns an error since Go 1.24.
	token = base64.RawURLEncoding.EncodeToString(b)
	return token, Session{
		TokenHash: HashToken(token),
		UserID:    userID,
		CreatedAt: now,
		ExpiresAt: now.Add(SessionTTL),
	}
}

func HashToken(token string) []byte {
	h := sha256.Sum256([]byte(token))
	return h[:]
}
