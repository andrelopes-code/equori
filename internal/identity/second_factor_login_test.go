package identity_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
)

var loginNow = time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)

type pendingChallenge struct {
	Methods []string `json:"methods"`
	Passkey *struct {
		Challenge        string   `json:"challenge"`
		AllowCredentials []string `json:"allow_credentials"`
	} `json:"passkey"`
}

// TestLoginWithTOTP covers S199.
func TestLoginWithTOTP(t *testing.T) {
	t.Parallel()

	h, _ := loginHarness(t)
	secret, _ := enableTOTP(t, h)
	right := domain.TOTPCode(secret, domain.TOTPStepAt(loginNow)+1)

	c, r := passwordLogin(t, h, "owner@example.com")
	if r.Status != http.StatusAccepted || strings.TrimSpace(string(r.Body)) != `{"methods":["totp","recovery_code"],"passkey":null}` {
		t.Fatalf("password = %d: %s", r.Status, r.Body)
	}

	set := r.Header.Values("Set-Cookie")
	if len(set) != 1 || !strings.HasPrefix(set[0], "equori_login=") || !strings.Contains(set[0], "Path=/api/v1/session") ||
		!strings.Contains(set[0], "HttpOnly") || !strings.Contains(set[0], "Expires=Sat, 31 Oct 2026 12:05:00 GMT") {
		t.Fatalf("Set-Cookie = %q", set)
	}

	r = answer(t, h, c, map[string]any{"totp_code": right})
	if r.Status != http.StatusNoContent {
		t.Fatalf("second factor = %d: %s", r.Status, r.Body)
	}

	set = r.Header.Values("Set-Cookie")
	if len(set) != 2 || !strings.HasPrefix(set[0], "equori_session=") || !strings.HasPrefix(set[1], "equori_login=") ||
		!strings.Contains(set[1], "Expires=Thu, 01 Jan 1970 00:00:00 GMT") {
		t.Fatalf("Set-Cookie = %q", set)
	}

	if r := h.Call(c, http.MethodGet, "/api/v1/me", nil); r.Status != http.StatusOK {
		t.Fatalf("GET /me = %d: %s", r.Status, r.Body)
	}

	if !strings.Contains(h.Logs(), "method=totp") {
		t.Fatal("logs hold no method=totp")
	}

	c, _ = passwordLogin(t, h, "owner@example.com")
	h.ExpectProblem(answer(t, h, c, map[string]any{"totp_code": right}), http.StatusUnauthorized, "second_factor_invalid", "")

	c, _ = passwordLogin(t, h, "owner@example.com")
	h.ExpectProblem(answer(t, h, c, map[string]any{}), http.StatusBadRequest, "invalid_request", "")
	h.ExpectProblem(answer(t, h, c, map[string]any{"totp_code": "000000", "recovery_code": "AAAA"}),
		http.StatusBadRequest, "invalid_request", "")
}

// TestLoginWithPasskey covers S200.
func TestLoginWithPasskey(t *testing.T) {
	t.Parallel()

	h, _ := loginHarness(t)
	key := newSoftKey([]byte{1, 2, 3, 4})
	registerPasskey(t, h, key)

	c, r := passwordLogin(t, h, "owner@example.com")
	first := decodeChallenge(t, r)

	if len(first.Methods) != 2 || first.Methods[0] != "passkey" || first.Methods[1] != "recovery_code" ||
		first.Passkey == nil || len(first.Passkey.AllowCredentials) != 1 || first.Passkey.AllowCredentials[0] != b64(key.credentialID) ||
		len(decodeB64(t, first.Passkey.Challenge)) != 32 {
		t.Fatalf("challenge = %s", r.Body)
	}

	bare := h.Call(&http.Client{}, http.MethodPost, "/api/v1/session",
		map[string]string{"email": "owner@example.com", "password": apitest.Password})
	if bare.Status != http.StatusAccepted || strings.TrimSpace(string(bare.Body)) != `{"methods":["recovery_code"],"passkey":null}` {
		t.Fatalf("password without Origin = %d: %s", bare.Status, bare.Body)
	}

	r = answer(t, h, c, key.assertion(key.credentialID, decodeB64(t, first.Passkey.Challenge), 1, h.URL()))
	if r.Status != http.StatusNoContent {
		t.Fatalf("assertion = %d: %s", r.Status, r.Body)
	}

	if r := h.Call(c, http.MethodGet, "/api/v1/me", nil); r.Status != http.StatusOK {
		t.Fatalf("GET /me = %d: %s", r.Status, r.Body)
	}

	if !strings.Contains(h.Logs(), "method=passkey") {
		t.Fatal("logs hold no method=passkey")
	}

	var (
		count int64
		used  time.Time
	)

	if err := h.Pool.QueryRow(t.Context(), `SELECT sign_count, last_used_at FROM identity_passkey`).Scan(&count, &used); err != nil {
		t.Fatal(err)
	}

	if count != 1 || !used.Equal(loginNow) {
		t.Fatalf("sign_count = %d, last_used_at = %s; want 1, %s", count, used, loginNow)
	}

	replay, r := passwordLogin(t, h, "owner@example.com")
	next := decodeChallenge(t, r)
	h.ExpectProblem(answer(t, h, replay, key.assertion(key.credentialID, decodeB64(t, next.Passkey.Challenge), 1, h.URL())),
		http.StatusUnauthorized, "second_factor_invalid", "")

	unknown, r := passwordLogin(t, h, "owner@example.com")
	next = decodeChallenge(t, r)
	h.ExpectProblem(answer(t, h, unknown, key.assertion([]byte{9, 9, 9, 9}, decodeB64(t, next.Passkey.Challenge), 2, h.URL())),
		http.StatusUnauthorized, "second_factor_invalid", "")

	stale, _ := passwordLogin(t, h, "owner@example.com")
	h.ExpectProblem(answer(t, h, stale, key.assertion(key.credentialID, decodeB64(t, first.Passkey.Challenge), 2, h.URL())),
		http.StatusUnauthorized, "second_factor_invalid", "")

	good, r := passwordLogin(t, h, "owner@example.com")
	next = decodeChallenge(t, r)

	if r := answer(t, h, good, key.assertion(key.credentialID, decodeB64(t, next.Passkey.Challenge), 2, h.URL())); r.Status != http.StatusNoContent {
		t.Fatalf("assertion = %d: %s", r.Status, r.Body)
	}
}

// TestLoginWithRecoveryCode covers S201.
func TestLoginWithRecoveryCode(t *testing.T) {
	t.Parallel()

	h, _ := loginHarness(t)
	_, codes := enableTOTP(t, h)

	c, _ := passwordLogin(t, h, "owner@example.com")
	hyphenated := strings.ToLower(codes[0][:4] + "-" + codes[0][4:8] + "-" + codes[0][8:12] + "-" + codes[0][12:])

	if r := answer(t, h, c, map[string]any{"recovery_code": hyphenated}); r.Status != http.StatusNoContent {
		t.Fatalf("recovery code = %d: %s", r.Status, r.Body)
	}

	if logs := h.Logs(); !strings.Contains(logs, "method=recovery_code") || !strings.Contains(logs, "recovery_codes_left=9") {
		t.Fatal("logs hold no method=recovery_code with recovery_codes_left=9")
	}

	var state struct {
		RecoveryCodesLeft int `json:"recovery_codes_left"`
	}

	r := h.Call(c, http.MethodGet, "/api/v1/me/second-factor", nil)
	r.Decode(t, &state)

	if r.Status != http.StatusOK || state.RecoveryCodesLeft != 9 {
		t.Fatalf("second factor = %d: %s", r.Status, r.Body)
	}

	c, _ = passwordLogin(t, h, "owner@example.com")
	h.ExpectProblem(answer(t, h, c, map[string]any{"recovery_code": codes[0]}),
		http.StatusUnauthorized, "second_factor_invalid", "")

	c, _ = passwordLogin(t, h, "owner@example.com")
	if r := answer(t, h, c, map[string]any{"recovery_code": codes[1]}); r.Status != http.StatusNoContent {
		t.Fatalf("second recovery code = %d: %s", r.Status, r.Body)
	}
}

// TestSecondFactorAttempts covers S202.
func TestSecondFactorAttempts(t *testing.T) {
	t.Parallel()

	h, _ := loginHarness(t)
	secret, _ := enableTOTP(t, h)
	right := domain.TOTPCode(secret, domain.TOTPStepAt(loginNow)+1)
	wrong := "000000"

	if right == wrong {
		wrong = "000001"
	}

	c, _ := passwordLogin(t, h, "owner@example.com")

	for range 5 {
		h.ExpectProblem(answer(t, h, c, map[string]any{"totp_code": wrong}), http.StatusUnauthorized, "second_factor_invalid", "")
	}

	h.ExpectProblem(answer(t, h, c, map[string]any{"totp_code": right}), http.StatusUnauthorized, "unauthenticated", "")

	var pending int

	if err := h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM identity_login_challenge`).Scan(&pending); err != nil || pending != 0 {
		t.Fatalf("pending logins = %d, %v; want 0", pending, err)
	}

	if !strings.Contains(h.Logs(), `reason="second factor invalid"`) {
		t.Fatal(`logs hold no reason="second factor invalid"`)
	}
}

// HA47: wrong answers sent at once to one pending login are still checked at most five times.
func TestSecondFactorAttemptsInParallel(t *testing.T) {
	t.Parallel()

	h, _ := loginHarness(t)
	secret, _ := enableTOTP(t, h)
	wrong := "000000"

	if domain.TOTPCode(secret, domain.TOTPStepAt(loginNow)+1) == wrong {
		wrong = "000001"
	}

	c, _ := passwordLogin(t, h, "owner@example.com")

	const requests = 20

	codes := make(chan string, requests)

	var wg sync.WaitGroup

	for range requests {
		wg.Go(func() {
			codes <- parallelAnswer(t.Context(), h.URL(), c, wrong)
		})
	}

	wg.Wait()
	close(codes)

	counts := map[string]int{}
	for code := range codes {
		counts[code]++
	}

	want := map[string]int{"second_factor_invalid": 5, "unauthenticated": requests - 5}
	if !maps.Equal(counts, want) {
		t.Fatalf("answers = %v; want %v", counts, want)
	}
}

func TestSecondFactorEdges(t *testing.T) {
	t.Parallel()

	t.Run("no pending login cookie", func(t *testing.T) {
		t.Parallel()

		h, _ := loginHarness(t)
		secret, _ := enableTOTP(t, h)
		right := domain.TOTPCode(secret, domain.TOTPStepAt(loginNow)+1)

		h.ExpectProblem(answer(t, h, newJarClient(t), map[string]any{"totp_code": right}),
			http.StatusUnauthorized, "unauthenticated", "")
	})

	t.Run("expired pending login", func(t *testing.T) {
		t.Parallel()

		h, clock := loginHarness(t)
		secret, _ := enableTOTP(t, h)
		c, _ := passwordLogin(t, h, "owner@example.com")
		later := loginNow.Add(5*time.Minute + time.Second)

		clock.Store(later.UnixNano())

		h.ExpectProblem(answer(t, h, c, map[string]any{"totp_code": domain.TOTPCode(secret, domain.TOTPStepAt(later))}),
			http.StatusUnauthorized, "unauthenticated", "")
	})

	t.Run("password throttle holds with a factor", func(t *testing.T) {
		t.Parallel()

		h, _ := loginHarness(t)
		enableTOTP(t, h)

		for range 5 {
			if _, r := passwordLogin(t, h, "owner@example.com"); r.Status != http.StatusAccepted {
				t.Fatalf("password = %d: %s", r.Status, r.Body)
			}
		}

		_, r := passwordLogin(t, h, "owner@example.com")
		h.ExpectProblem(r, http.StatusTooManyRequests, "too_many_attempts", "")
	})

	t.Run("member without a factor", func(t *testing.T) {
		t.Parallel()

		h, _ := loginHarness(t)
		h.Login("plain@example.com")

		_, r := passwordLogin(t, h, "plain@example.com")
		if set := r.Header.Values("Set-Cookie"); r.Status != http.StatusNoContent || len(set) != 1 || !strings.HasPrefix(set[0], "equori_session=") {
			t.Fatalf("password = %d, Set-Cookie %q", r.Status, set)
		}

		if !strings.Contains(h.Logs(), "method=password") {
			t.Fatal("logs hold no method=password")
		}
	})

	t.Run("server without secret key", func(t *testing.T) {
		t.Parallel()

		h, clock := loginHarness(t)
		secret, codes := enableTOTP(t, h)

		h.Restart(clockOption(clock))

		c, _ := passwordLogin(t, h, "owner@example.com")
		h.ExpectProblem(answer(t, h, c, map[string]any{"totp_code": domain.TOTPCode(secret, domain.TOTPStepAt(loginNow)+1)}),
			http.StatusConflict, "secret_key_missing", "")

		if r := answer(t, h, c, map[string]any{"recovery_code": codes[0]}); r.Status != http.StatusNoContent {
			t.Fatalf("recovery code = %d: %s", r.Status, r.Body)
		}
	})

	t.Run("access token survives the first factor", func(t *testing.T) {
		t.Parallel()

		h, _ := loginHarness(t)
		token := createToken(t, h, h.Client, "read")

		enableTOTP(t, h)

		if _, err := h.App.Identity.VerifyAccessToken(t.Context(), *token.Token); err != nil {
			t.Fatalf("VerifyAccessToken = %v", err)
		}
	})

	t.Run("rotated secret key", func(t *testing.T) {
		t.Parallel()

		h, clock := loginHarness(t)
		secret, _ := enableTOTP(t, h)
		rotated := "another-test-secret-key-32bytes!"

		h.Restart(apitest.SecretKeys(rotated, apitest.SecretKey), clockOption(clock))

		if n, err := h.App.Identity.RotateSecrets(t.Context()); err != nil || n != 1 {
			t.Fatalf("RotateSecrets = %d, %v, want 1", n, err)
		}

		h.Restart(apitest.SecretKeys(rotated, ""), clockOption(clock))

		c, _ := passwordLogin(t, h, "owner@example.com")
		if r := answer(t, h, c, map[string]any{"totp_code": domain.TOTPCode(secret, domain.TOTPStepAt(loginNow)+1)}); r.Status != http.StatusNoContent {
			t.Fatalf("totp code = %d: %s", r.Status, r.Body)
		}
	})
}

// loginHarness returns a harness with a secret key and an identity clock at loginNow.
func loginHarness(t *testing.T) (*apitest.Harness, *atomic.Int64) {
	t.Helper()

	var clock atomic.Int64

	clock.Store(loginNow.UnixNano())

	return apitest.New(t, apitest.SecretKeys(apitest.SecretKey, ""), clockOption(&clock)), &clock
}

func clockOption(clock *atomic.Int64) apitest.Option {
	return apitest.IdentityClock(func() time.Time { return time.Unix(0, clock.Load()).UTC() })
}

// enableTOTP confirms a TOTP of the owner at the step of loginNow.
func enableTOTP(t *testing.T, h *apitest.Harness) (secret []byte, codes []string) {
	t.Helper()

	secret = decodeSecret(t, startTOTP(t, h).Secret)

	var confirmed struct {
		RecoveryCodes []string `json:"recovery_codes"`
	}

	h.MustDo(http.MethodPost, "/api/v1/me/totp/confirm",
		map[string]string{"code": domain.TOTPCode(secret, domain.TOTPStepAt(loginNow))}, http.StatusOK, &confirmed)

	return secret, confirmed.RecoveryCodes
}

// passwordLogin posts the right password of email with an Origin on a client with a new cookie jar.
func passwordLogin(t *testing.T, h *apitest.Harness, email string) (*http.Client, apitest.Response) {
	t.Helper()

	c := newJarClient(t)

	body, err := jsonBody(map[string]string{"email": email, "password": apitest.Password})
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, h.URL()+"/api/v1/session", body)
	if err != nil {
		t.Fatal(err)
	}

	req.Header.Set("Origin", h.URL())
	req.Header.Set("Content-Type", "application/json")

	r := h.Send(c, req)

	// The jar compares the cookie's Expires with the wall clock, while the identity clock is fixed;
	// the pending login cookie is stored again without Expires.
	for _, ck := range (&http.Response{Header: r.Header}).Cookies() {
		if ck.Name == "equori_login" {
			base, err := url.Parse(h.URL() + "/api/v1/session")
			if err != nil {
				t.Fatal(err)
			}

			c.Jar.SetCookies(base, []*http.Cookie{{Name: ck.Name, Value: ck.Value, Path: ck.Path}})
		}
	}

	return c, r
}

func answer(t *testing.T, h *apitest.Harness, c *http.Client, body any) apitest.Response {
	t.Helper()

	reader, err := jsonBody(body)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, h.URL()+"/api/v1/session/second-factor", reader)
	if err != nil {
		t.Fatal(err)
	}

	req.Header.Set("Origin", h.URL())
	req.Header.Set("Content-Type", "application/json")

	return h.Send(c, req)
}

func decodeChallenge(t *testing.T, r apitest.Response) pendingChallenge {
	t.Helper()

	if r.Status != http.StatusAccepted {
		t.Fatalf("password = %d: %s", r.Status, r.Body)
	}

	var c pendingChallenge

	r.Decode(t, &c)

	return c
}

func newJarClient(t *testing.T) *http.Client {
	t.Helper()

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}

	return &http.Client{Jar: jar}
}

func jsonBody(v any) (*bytes.Buffer, error) {
	var b bytes.Buffer

	if err := json.NewEncoder(&b).Encode(v); err != nil {
		return nil, err
	}

	return &b, nil
}

// assertion builds the body of completeSecondFactor for a passkey, signed over challenge.
func (k softKey) assertion(credentialID, challenge []byte, counter uint32, origin string) map[string]any {
	clientData := k.clientData("webauthn.get", challenge, origin)
	authData := k.assertionData("127.0.0.1", 0x01, counter)

	return map[string]any{"passkey": map[string]string{
		"credential_id":      b64(credentialID),
		"client_data_json":   b64(clientData),
		"authenticator_data": b64(authData),
		"signature":          b64(k.sign(authData, clientData)),
	}}
}

// parallelAnswer posts a TOTP code from a goroutine and returns the problem code, or a description
// of what failed, since t.Fatal must not run outside the test goroutine.
func parallelAnswer(ctx context.Context, baseURL string, c *http.Client, code string) string {
	body := strings.NewReader(fmt.Sprintf(`{"totp_code":%q}`, code))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/api/v1/session/second-factor", body)
	if err != nil {
		return err.Error()
	}

	req.Header.Set("Origin", baseURL)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.Do(req) //nolint:gosec // tests address the harness's own httptest server
	if err != nil {
		return err.Error()
	}
	defer resp.Body.Close()

	var problem struct {
		Code string `json:"code"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&problem); err != nil {
		return fmt.Sprintf("status %d: %v", resp.StatusCode, err)
	}

	return problem.Code
}
