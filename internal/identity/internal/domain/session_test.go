package domain

import (
	"bytes"
	"testing"
	"time"
)

func TestNewSession(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)

	token, s := NewSession(7, 9, now)
	other, _ := NewSession(7, 9, now)

	if token == other {
		t.Fatal("two sessions share a token")
	}

	if !bytes.Equal(s.TokenHash, HashToken(token)) {
		t.Fatal("TokenHash does not match HashToken(token)")
	}

	if s.MemberID != 7 || s.BooksID != 9 || !s.CreatedAt.Equal(now) || !s.ExpiresAt.Equal(now.Add(SessionTTL)) {
		t.Fatalf("unexpected session %+v", s)
	}
}
