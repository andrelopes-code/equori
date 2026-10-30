package domain

import (
	"crypto/rand"
	"encoding/base64"
	"time"

	"github.com/google/uuid"
)

const InvitationTTL = 7 * 24 * time.Hour

// Invitation is persisted by TokenHash only; the token exists only in the answer of its creation.
type Invitation struct {
	ID        uuid.UUID
	BooksID   int64
	Email     string
	Role      string
	TokenHash []byte
	InvitedBy int64
	CreatedAt time.Time
	ExpiresAt time.Time
}

// NewInvitation returns the token, shown once, and the invitation that stores its hash (HA24).
func NewInvitation(booksID, invitedBy int64, email, role string, now time.Time) (token string, inv Invitation) {
	b := make([]byte, 32)
	_, _ = rand.Read(b) // crypto/rand.Read never returns an error since Go 1.24.
	token = base64.RawURLEncoding.EncodeToString(b)

	return token, Invitation{
		ID:        uuid.New(),
		BooksID:   booksID,
		Email:     email,
		Role:      role,
		TokenHash: HashToken(token),
		InvitedBy: invitedBy,
		CreatedAt: now,
		ExpiresAt: now.Add(InvitationTTL),
	}
}
