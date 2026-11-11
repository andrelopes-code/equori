package domain

import (
	"crypto/rand"
	"encoding/base64"
	"time"

	"github.com/google/uuid"
)

const ChallengeTTL = 5 * time.Minute

// Passkey is a WebAuthn credential used as a second factor on one RP ID (HA43).
type Passkey struct {
	ID           uuid.UUID
	MemberID     int64
	CredentialID []byte
	PublicKey    []byte
	Algorithm    int
	SignCount    uint32
	RPID         string
	Name         string
	CreatedAt    time.Time
	LastUsedAt   *time.Time
}

// LoginChallenge is a pending login (HA46); the token exists only in the cookie equori_login.
type LoginChallenge struct {
	TokenHash []byte
	MemberID  int64
	Challenge []byte
	ExpiresAt time.Time
}

// NewLoginChallenge returns a 32-byte base64url token and its row, with a 32-byte challenge and
// expiry ChallengeTTL after now.
func NewLoginChallenge(memberID int64, now time.Time) (token string, c LoginChallenge) {
	token = base64.RawURLEncoding.EncodeToString(NewChallenge(32))

	return token, LoginChallenge{
		TokenHash: HashToken(token),
		MemberID:  memberID,
		Challenge: NewChallenge(32),
		ExpiresAt: now.Add(ChallengeTTL),
	}
}

// NewChallenge returns n random bytes.
func NewChallenge(n int) []byte {
	b := make([]byte, n)
	_, _ = rand.Read(b) // crypto/rand.Read never returns an error since Go 1.24.

	return b
}
