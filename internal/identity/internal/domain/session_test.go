package domain

import (
	"bytes"
	"testing"
	"time"
)

func TestNewSession(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)

	token, s := NewSession(7, now)
	other, _ := NewSession(7, now)

	if token == other {
		t.Fatal("two sessions share a token")
	}
	if !bytes.Equal(s.TokenHash, HashToken(token)) {
		t.Fatal("TokenHash does not match HashToken(token)")
	}
	if s.UserID != 7 || !s.CreatedAt.Equal(now) || !s.ExpiresAt.Equal(now.Add(SessionTTL)) {
		t.Fatalf("unexpected session %+v", s)
	}
}
