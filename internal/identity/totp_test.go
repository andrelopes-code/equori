package identity_test

import (
	"bytes"
	"encoding/base32"
	"encoding/json"
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
)

const wrongPassword = "wrong password 1"

func TestTOTPEnrolment(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)
	h := apitest.New(t, apitest.SecretKeys(apitest.SecretKey, ""), apitest.IdentityClock(func() time.Time { return now }))
	other := h.SignIn("owner@example.com")

	expectEmptySecondFactor(t, h)
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/me/totp/confirm", map[string]string{"code": "123456"}),
		http.StatusUnprocessableEntity, "totp_code_invalid", "")

	first := startTOTP(t, h)
	secret := startTOTP(t, h)

	if first.Secret == secret.Secret {
		t.Fatal("the second startTotp returned the first secret")
	}

	raw := decodeSecret(t, secret.Secret)

	if len(secret.Secret) != 32 || secret.URI != domain.TOTPURI("owner@example.com", raw) {
		t.Fatalf("setup = %+v", secret)
	}

	code := domain.TOTPCode(raw, domain.TOTPStepAt(now))
	if stale := domain.TOTPCode(decodeSecret(t, first.Secret), domain.TOTPStepAt(now)); stale != code {
		h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/me/totp/confirm", map[string]string{"code": stale}),
			http.StatusUnprocessableEntity, "totp_code_invalid", "")
	}

	var confirmed struct {
		RecoveryCodes []string `json:"recovery_codes"`
	}
	h.MustDo(http.MethodPost, "/api/v1/me/totp/confirm", map[string]string{"code": code}, http.StatusOK, &confirmed)

	if len(confirmed.RecoveryCodes) != 10 {
		t.Fatalf("recovery codes = %v", confirmed.RecoveryCodes)
	}

	h.ExpectProblem(h.Call(other, http.MethodGet, "/api/v1/me/second-factor", nil), http.StatusUnauthorized, "unauthenticated", "")

	var state struct {
		TOTP              bool  `json:"totp"`
		RecoveryCodesLeft int   `json:"recovery_codes_left"`
		Passkeys          []any `json:"passkeys"`
	}
	h.MustDo(http.MethodGet, "/api/v1/me/second-factor", nil, http.StatusOK, &state)

	if !state.TOTP || state.RecoveryCodesLeft != 10 || len(state.Passkeys) != 0 {
		t.Fatalf("second factor = %+v", state)
	}

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/me/totp", nil), http.StatusConflict, "totp_enabled", "")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/me/totp/confirm", map[string]string{"code": code}), http.StatusConflict, "totp_enabled", "")

	var sealed []byte
	if err := h.Pool.QueryRow(t.Context(), `SELECT sealed_secret FROM identity_totp`).Scan(&sealed); err != nil {
		t.Fatal(err)
	}

	if bytes.Contains(sealed, raw) {
		t.Fatal("the stored secret holds the plain bytes")
	}

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/me/recovery-codes", map[string]string{"password": wrongPassword}),
		http.StatusForbidden, "password_invalid", "")

	var regenerated struct {
		RecoveryCodes []string `json:"recovery_codes"`
	}
	h.MustDo(http.MethodPost, "/api/v1/me/recovery-codes", map[string]string{"password": apitest.Password}, http.StatusOK, &regenerated)

	if len(regenerated.RecoveryCodes) != 10 {
		t.Fatalf("regenerated codes = %v", regenerated.RecoveryCodes)
	}

	for _, c := range regenerated.RecoveryCodes {
		if slices.Contains(confirmed.RecoveryCodes, c) {
			t.Fatalf("code %s survived the regeneration", c)
		}
	}

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/me/totp/disable", map[string]string{"password": wrongPassword}),
		http.StatusForbidden, "password_invalid", "")
	h.MustDo(http.MethodPost, "/api/v1/me/totp/disable", map[string]string{"password": apitest.Password}, http.StatusNoContent, nil)
	expectEmptySecondFactor(t, h)
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/me/recovery-codes", map[string]string{"password": apitest.Password}),
		http.StatusConflict, "second_factor_missing", "")
}

func TestTOTPWithoutSecretKey(t *testing.T) {
	t.Parallel()

	h := apitest.New(t)

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/me/totp", nil), http.StatusConflict, "secret_key_missing", "")
}

func TestPasswordCheckThrottled(t *testing.T) {
	t.Parallel()

	h, _ := confirmedTOTP(t)

	for range 5 {
		h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/me/totp/disable", map[string]string{"password": wrongPassword}),
			http.StatusForbidden, "password_invalid", "")
	}

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/me/totp/disable", map[string]string{"password": apitest.Password}),
		http.StatusTooManyRequests, "too_many_attempts", "")
}

func TestRotateTOTPSecret(t *testing.T) {
	t.Parallel()

	h, clock := confirmedTOTP(t)
	rotated := "another-test-secret-key-32bytes!"

	h.Restart(apitest.SecretKeys(rotated, apitest.SecretKey), clock)

	if n, err := h.App.Identity.RotateSecrets(t.Context()); err != nil || n != 1 {
		t.Fatalf("RotateSecrets = %d, %v, want 1", n, err)
	}

	h.Restart(apitest.SecretKeys(rotated, ""), clock)

	if n, err := h.App.Identity.RotateSecrets(t.Context()); err != nil || n != 0 {
		t.Fatalf("second RotateSecrets = %d, %v, want 0", n, err)
	}
}

type totpSetup struct {
	Secret string `json:"secret"`
	URI    string `json:"uri"`
}

// confirmedTOTP returns a harness whose owner has a confirmed TOTP, and the clock option it runs on.
func confirmedTOTP(t *testing.T) (*apitest.Harness, apitest.Option) {
	t.Helper()

	now := time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)
	clock := apitest.IdentityClock(func() time.Time { return now })
	h := apitest.New(t, apitest.SecretKeys(apitest.SecretKey, ""), clock)

	secret := decodeSecret(t, startTOTP(t, h).Secret)
	code := domain.TOTPCode(secret, domain.TOTPStepAt(now))
	h.MustDo(http.MethodPost, "/api/v1/me/totp/confirm", map[string]string{"code": code}, http.StatusOK, nil)

	return h, clock
}

func startTOTP(t *testing.T, h *apitest.Harness) totpSetup {
	t.Helper()

	var setup totpSetup
	h.MustDo(http.MethodPost, "/api/v1/me/totp", nil, http.StatusOK, &setup)

	return setup
}

func decodeSecret(t *testing.T, encoded string) []byte {
	t.Helper()

	raw, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(encoded)
	if err != nil {
		t.Fatal(err)
	}

	return raw
}

func expectEmptySecondFactor(t *testing.T, h *apitest.Harness) {
	t.Helper()

	r := h.Do(http.MethodGet, "/api/v1/me/second-factor", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	var state struct {
		TOTP              bool            `json:"totp"`
		Passkeys          json.RawMessage `json:"passkeys"`
		RecoveryCodesLeft int             `json:"recovery_codes_left"`
	}
	r.Decode(t, &state)

	if state.TOTP || string(state.Passkeys) != "[]" || state.RecoveryCodesLeft != 0 {
		t.Fatalf("body = %s, want totp false, passkeys [] and recovery_codes_left 0", r.Body)
	}
}
