package domain

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1" //nolint:gosec // G505: RFC 6238 specifies HMAC-SHA-1 for the authenticator apps (HA33).
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"time"
)

const (
	TOTPStep = 30 * time.Second

	totpSecretBytes = 20
	totpDigits      = 1_000_000
)

// TOTP is the stored secret of a member (HA34).
type TOTP struct {
	MemberID  int64
	Sealed    []byte
	Confirmed bool
	LastStep  int64
}

var totpEncoding = base32.StdEncoding.WithPadding(base32.NoPadding)

// NewTOTPSecret returns 20 random bytes (HA33).
func NewTOTPSecret() []byte {
	b := make([]byte, totpSecretBytes)
	_, _ = rand.Read(b) // crypto/rand.Read never returns an error since Go 1.24.

	return b
}

// EncodeTOTPSecret returns the secret in base32 without padding.
func EncodeTOTPSecret(secret []byte) string { return totpEncoding.EncodeToString(secret) }

// TOTPStepAt returns the RFC 6238 time step of t: Unix seconds divided by 30.
func TOTPStepAt(t time.Time) int64 { return t.Unix() / int64(TOTPStep/time.Second) }

// TOTPCode returns the 6-digit code of secret at step (RFC 4226 over HMAC-SHA-1).
func TOTPCode(secret []byte, step int64) string {
	mac := hmac.New(sha1.New, secret)
	_ = binary.Write(mac, binary.BigEndian, uint64(step)) //nolint:gosec // G115: steps are positive.
	sum := mac.Sum(nil)

	offset := sum[len(sum)-1] & 0x0f
	value := binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7fffffff

	return fmt.Sprintf("%06d", value%totpDigits)
}

// MatchTOTP returns the step in [step(now)-1, step(now)+1], above last, whose code equals code.
func MatchTOTP(secret []byte, code string, now time.Time, last int64) (int64, bool) {
	current := TOTPStepAt(now)

	for step := current - 1; step <= current+1; step++ {
		if step > last && subtle.ConstantTimeCompare([]byte(code), []byte(TOTPCode(secret, step))) == 1 {
			return step, true
		}
	}

	return 0, false
}

// TOTPURI returns the otpauth URI of HA35.
func TOTPURI(email string, secret []byte) string {
	return "otpauth://totp/equori:" + url.PathEscape(email) +
		"?secret=" + EncodeTOTPSecret(secret) +
		"&issuer=equori"
}

// TOTPRow is the associated data of a sealed TOTP secret (ADR 008, K3).
func TOTPRow(memberID int64) []byte { return fmt.Appendf(nil, "identity_totp|%d", memberID) }
