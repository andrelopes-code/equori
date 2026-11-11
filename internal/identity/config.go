package identity

import (
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

type Config struct {
	SecureCookies bool
	// DefaultCurrency is the base currency of a region (ADR 016); SetupDone runs after the
	// first member setup (W-U5).
	DefaultCurrency func(region string) (money.Currency, bool)
	SetupDone       func()
	// SecretKey and PreviousSecretKey seal TOTP secrets (ADR 008); empty disables TOTP.
	SecretKey, PreviousSecretKey string
	// Now is the clock of sessions and second factors; nil is time.Now.
	Now func() time.Time
	// PasswordCost lowers the argon2id cost of new hashes; production leaves it zero, the OWASP
	// minimum, and the test harness sets it.
	PasswordCost PasswordCost
}

// PasswordCost is the memory and the iterations of argon2id; a zero field keeps the default.
type PasswordCost struct {
	MemoryKiB, Iterations uint32
}
