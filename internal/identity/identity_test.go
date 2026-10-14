package identity_test

import (
	"encoding/json/v2"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

const (
	email    = "ann@example.com"
	password = "correct horse battery"
)

type harness struct {
	t          *testing.T
	module     *identity.Module
	server     *httptest.Server
	client     *http.Client
	probeCalls atomic.Int32
}

// newHarness wires the module the same way cmd/equori does.
func newHarness(t *testing.T, cfg identity.Config) *harness {
	t.Helper()
	h := &harness{t: t}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	m := identity.New(pgtest.New(t), cfg, log)
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)
	mux.HandleFunc("GET /api/v1/probe", func(http.ResponseWriter, *http.Request) { h.probeCalls.Add(1) })
	mux.Handle("/api/", httpserver.NotFound())
	srv := httptest.NewServer(httpserver.Middleware(m.RequireSession(mux), log))
	t.Cleanup(srv.Close)
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	h.module, h.server, h.client = m, srv, &http.Client{Jar: jar}
	return h
}

type response struct {
	status int
	header http.Header
	body   []byte
}

func (h *harness) do(method, path, body string) response {
	h.t.Helper()
	req, err := http.NewRequestWithContext(h.t.Context(), method, h.server.URL+path, strings.NewReader(body))
	if err != nil {
		h.t.Fatal(err)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := h.client.Do(req)
	if err != nil {
		h.t.Fatal(err)
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		h.t.Fatal(err)
	}
	return response{status: resp.StatusCode, header: resp.Header, body: b}
}

func (h *harness) login(pw string) response {
	h.t.Helper()
	return h.do(http.MethodPost, "/api/v1/session", `{"email":"`+email+`","password":"`+pw+`"}`)
}

func expectProblem(t *testing.T, resp response, status int, code string) {
	t.Helper()
	if resp.status != status {
		t.Fatalf("status = %d, want %d", resp.status, status)
	}
	var body struct {
		Code      string `json:"code"`
		RequestID string `json:"request_id"`
	}
	if err := json.Unmarshal(resp.body, &body); err != nil {
		t.Fatal(err)
	}
	if body.Code != code || body.RequestID == "" {
		t.Fatalf("problem = %+v, want code %q and a request_id", body, code)
	}
}

func TestSessionLifecycle(t *testing.T) {
	h := newHarness(t, identity.Config{})
	if _, err := h.module.CreateUser(t.Context(), email, password, identity.RoleAdmin); err != nil {
		t.Fatal(err)
	}

	expectProblem(t, h.do(http.MethodGet, "/api/v1/me", ""), http.StatusUnauthorized, "unauthenticated")

	if resp := h.login(password); resp.status != http.StatusNoContent {
		t.Fatalf("login status = %d, want 204", resp.status)
	}

	resp := h.do(http.MethodGet, "/api/v1/me", "")
	if resp.status != http.StatusOK {
		t.Fatalf("me status = %d, want 200", resp.status)
	}
	var me struct {
		ID    int64  `json:"id"`
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := json.Unmarshal(resp.body, &me); err != nil {
		t.Fatal(err)
	}
	if me.ID == 0 || me.Email != email || me.Role != identity.RoleAdmin {
		t.Fatalf("me = %+v", me)
	}

	if resp := h.do(http.MethodDelete, "/api/v1/session", ""); resp.status != http.StatusNoContent {
		t.Fatalf("logout status = %d, want 204", resp.status)
	}
	expectProblem(t, h.do(http.MethodGet, "/api/v1/me", ""), http.StatusUnauthorized, "unauthenticated")
}

func TestLoginFailures(t *testing.T) {
	h := newHarness(t, identity.Config{})
	if _, err := h.module.CreateUser(t.Context(), email, password, identity.RoleMember); err != nil {
		t.Fatal(err)
	}

	expectProblem(t, h.do(http.MethodPost, "/api/v1/session", `{"email":`), http.StatusBadRequest, "invalid_request")
	expectProblem(t,
		h.do(http.MethodPost, "/api/v1/session", `{"email":"nobody@example.com","password":"`+password+`"}`),
		http.StatusUnauthorized, "invalid_credentials")

	for range 5 {
		expectProblem(t, h.login("wrong password!"), http.StatusUnauthorized, "invalid_credentials")
	}
	// The correct password is refused while the email is throttled.
	expectProblem(t, h.login(password), http.StatusTooManyRequests, "too_many_attempts")
}

func TestRequireSessionDeniesByDefault(t *testing.T) {
	h := newHarness(t, identity.Config{})

	expectProblem(t, h.do(http.MethodGet, "/api/v1/probe", ""), http.StatusUnauthorized, "unauthenticated")
	expectProblem(t, h.do(http.MethodGet, "/api/v2/anything", ""), http.StatusUnauthorized, "unauthenticated")

	for _, path := range []string{"/x/../api/v1/probe", "//api/v1/probe", "/%61pi/v1/probe", "/api/v1/./probe"} {
		if resp := h.do(http.MethodGet, path, ""); resp.status == http.StatusOK {
			t.Errorf("GET %s = 200 without a session", path)
		}
	}

	h.client.Jar.SetCookies(mustURL(t, h.server.URL), []*http.Cookie{{Name: "equori_session", Value: "forged"}})
	expectProblem(t, h.do(http.MethodGet, "/api/v1/probe", ""), http.StatusUnauthorized, "unauthenticated")

	if n := h.probeCalls.Load(); n != 0 {
		t.Fatalf("protected handler ran %d times without a valid session", n)
	}
}

func TestUnknownAPIRoute(t *testing.T) {
	h := newHarness(t, identity.Config{})
	if _, err := h.module.CreateUser(t.Context(), email, password, identity.RoleMember); err != nil {
		t.Fatal(err)
	}
	h.login(password)

	expectProblem(t, h.do(http.MethodGet, "/api/v1/nope", ""), http.StatusNotFound, "not_found")
}

func TestLoginBodyTooLarge(t *testing.T) {
	h := newHarness(t, identity.Config{})
	body := `{"email":"` + email + `","password":"` + strings.Repeat("a", 2<<20) + `"}`

	expectProblem(t, h.do(http.MethodPost, "/api/v1/session", body), http.StatusRequestEntityTooLarge, "request_too_large")
}

func TestConcurrentLoginAttemptsRespectLimit(t *testing.T) {
	h := newHarness(t, identity.Config{})
	if _, err := h.module.CreateUser(t.Context(), email, password, identity.RoleMember); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	statuses := make(chan int, 20)
	for range 20 {
		wg.Go(func() { statuses <- h.login("wrong password!").status })
	}
	wg.Wait()
	close(statuses)

	unauthorized := 0
	for s := range statuses {
		if s == http.StatusUnauthorized {
			unauthorized++
		}
	}
	if unauthorized != 5 {
		t.Fatalf("%d of 20 concurrent attempts reached password verification, want 5", unauthorized)
	}
}

func TestSessionCookieAttributes(t *testing.T) {
	h := newHarness(t, identity.Config{SecureCookies: true})
	if _, err := h.module.CreateUser(t.Context(), email, password, identity.RoleMember); err != nil {
		t.Fatal(err)
	}

	cookie := h.login(password).header.Get("Set-Cookie")
	for _, attr := range []string{"equori_session=", "Path=/", "HttpOnly", "Secure", "SameSite=Lax", "Expires="} {
		if !strings.Contains(cookie, attr) {
			t.Errorf("Set-Cookie %q lacks %s", cookie, attr)
		}
	}
}

func TestCreateUserValidation(t *testing.T) {
	h := newHarness(t, identity.Config{})
	ctx := t.Context()

	if _, err := h.module.CreateUser(ctx, "not an email", password, identity.RoleMember); err == nil {
		t.Fatal("invalid email accepted")
	}
	if _, err := h.module.CreateUser(ctx, email, "short", identity.RoleMember); err == nil {
		t.Fatal("short password accepted")
	}
	if _, err := h.module.CreateUser(ctx, email, password, "owner"); err == nil {
		t.Fatal("unknown role accepted")
	}
	if _, err := h.module.CreateUser(ctx, email, password, identity.RoleMember); err != nil {
		t.Fatal(err)
	}
	if _, err := h.module.CreateUser(ctx, "ANN@example.com", password, identity.RoleMember); !errors.Is(err, identity.ErrEmailTaken) {
		t.Fatalf("duplicate email with different case err = %v, want ErrEmailTaken", err)
	}
}

func mustURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	return u
}
