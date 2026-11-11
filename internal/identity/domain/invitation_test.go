package domain

import (
	"bytes"
	"testing"
	"time"
)

func TestNewInvitation(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 10, 30, 12, 0, 0, 0, time.UTC)

	token, inv := NewInvitation(7, 3, "new@example.com", "write", now)

	if want := now.Add(168 * time.Hour); !inv.ExpiresAt.Equal(want) {
		t.Errorf("ExpiresAt = %v, want %v", inv.ExpiresAt, want)
	}

	if !bytes.Equal(inv.TokenHash, HashToken(token)) {
		t.Errorf("TokenHash does not equal HashToken(token)")
	}

	if len(token) != 43 {
		t.Errorf("len(token) = %d, want 43", len(token))
	}

	if inv.BooksID != 7 || inv.InvitedBy != 3 || inv.Email != "new@example.com" || inv.Role != "write" || !inv.CreatedAt.Equal(now) {
		t.Errorf("invitation = %+v", inv)
	}

	other, _ := NewInvitation(7, 3, "new@example.com", "write", now)
	if other == token {
		t.Errorf("two calls returned the same token")
	}
}
