package domain

import (
	"crypto/rand"
	"crypto/sha256"
	"strings"
)

const (
	RecoveryCodeCount = 10

	recoveryCodeBytes = 10
	recoveryCodeChars = 16
)

// NewRecoveryCodes returns RecoveryCodeCount codes of 16 base32 characters and their hashes (HA38).
func NewRecoveryCodes() (codes []string, hashes [][]byte) {
	for range RecoveryCodeCount {
		b := make([]byte, recoveryCodeBytes)
		_, _ = rand.Read(b) // crypto/rand.Read never returns an error since Go 1.24.

		code := totpEncoding.EncodeToString(b)
		hash := sha256.Sum256([]byte(code))

		codes = append(codes, code)
		hashes = append(hashes, hash[:])
	}

	return codes, hashes
}

// HashRecoveryCode upper-cases code, drops spaces and hyphens and returns its SHA-256; false
// unless 16 base32 characters remain.
func HashRecoveryCode(code string) ([]byte, bool) {
	code = strings.ToUpper(strings.NewReplacer(" ", "", "-", "").Replace(code))
	if len(code) != recoveryCodeChars {
		return nil, false
	}

	for _, c := range code {
		if (c < 'A' || c > 'Z') && (c < '2' || c > '7') {
			return nil, false
		}
	}

	hash := sha256.Sum256([]byte(code))

	return hash[:], true
}
