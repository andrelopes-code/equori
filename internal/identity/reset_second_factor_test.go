package identity_test

import (
	"errors"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/identity"
)

// TestResetSecondFactor covers HA49.
func TestResetSecondFactor(t *testing.T) {
	t.Parallel()

	h, _ := loginHarness(t)
	enableTOTP(t, h)
	registerPasskey(t, h, newSoftKey([]byte{1, 2, 3, 4}))

	_, pending := passwordLogin(t, h, "owner@example.com")
	if pending.Status != http.StatusAccepted {
		t.Fatalf("password = %d: %s", pending.Status, pending.Body)
	}

	id, err := h.App.Identity.ResetSecondFactor(t.Context(), "OWNER@example.com")
	if err != nil {
		t.Fatal(err)
	}

	if id != h.MemberIDOf("owner@example.com") {
		t.Fatalf("member ID = %d, want %d", id, h.MemberIDOf("owner@example.com"))
	}

	for _, table := range []string{
		"identity_totp", "identity_passkey", "identity_recovery_code",
		"identity_passkey_challenge", "identity_login_challenge", "identity_session",
	} {
		var n int

		if err := h.Pool.QueryRow(t.Context(),
			`SELECT count(*) FROM `+table+` WHERE member_id = $1`, id).Scan(&n); err != nil {
			t.Fatal(err)
		}

		if n != 0 {
			t.Errorf("%s rows = %d, want 0", table, n)
		}
	}

	if r := h.Call(h.Client, http.MethodGet, "/api/v1/me", nil); r.Status != http.StatusUnauthorized {
		t.Fatalf("GET /me = %d: %s", r.Status, r.Body)
	}

	if _, r := passwordLogin(t, h, "owner@example.com"); r.Status != http.StatusNoContent {
		t.Fatalf("password = %d: %s", r.Status, r.Body)
	}

	_, err = h.App.Identity.ResetSecondFactor(t.Context(), "nobody@example.com")
	if !errors.Is(err, identity.ErrUnknownEmail) {
		t.Fatalf("err = %v, want ErrUnknownEmail", err)
	}
}
