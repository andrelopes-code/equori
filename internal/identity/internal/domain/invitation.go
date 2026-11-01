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
	token = newToken()

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

// AccountInvitation invites an email to a member of its own with a book of its own; like
// Invitation it is persisted by TokenHash only.
type AccountInvitation struct {
	ID           uuid.UUID
	Email        string
	Region       string
	BaseCurrency string
	TokenHash    []byte
	InvitedBy    int64
	CreatedAt    time.Time
	ExpiresAt    time.Time
}

// NewAccountInvitation returns the token, shown once, and the invitation that stores its hash.
func NewAccountInvitation(invitedBy int64, email, region, baseCurrency string, now time.Time) (token string, inv AccountInvitation) {
	token = newToken()

	return token, AccountInvitation{
		ID:           uuid.New(),
		Email:        email,
		Region:       region,
		BaseCurrency: baseCurrency,
		TokenHash:    HashToken(token),
		InvitedBy:    invitedBy,
		CreatedAt:    now,
		ExpiresAt:    now.Add(InvitationTTL),
	}
}

func newToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b) // crypto/rand.Read never returns an error since Go 1.24.

	return base64.RawURLEncoding.EncodeToString(b)
}
