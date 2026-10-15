// Package apitest runs the application of internal/server against a test
// database and drives it over HTTP with a logged-in user.
package apitest

import (
	"encoding/json/v2"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
	"github.com/andrelopes-code/equori/internal/server"
)

const Password = "correct horse battery"

type Harness struct {
	t      *testing.T
	Pool   *pgxpool.Pool
	App    *server.App
	server *httptest.Server
	Client *http.Client
}

// New starts the application and logs in owner@example.com as Client.
func New(t *testing.T) *Harness {
	t.Helper()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	pool := pgtest.New(t)
	app := server.New(pool, server.Config{}, log)
	srv := httptest.NewServer(app.Handler)
	t.Cleanup(srv.Close)
	h := &Harness{t: t, Pool: pool, App: app, server: srv}
	h.Client = h.Login("owner@example.com")
	return h
}

// Login creates the user, runs the outbox so the ledger provisions it, and returns a client with its session.
func (h *Harness) Login(email string) *http.Client {
	h.t.Helper()
	if _, err := h.App.Identity.CreateUser(h.t.Context(), email, Password, identity.RoleAdmin); err != nil {
		h.t.Fatal(err)
	}
	h.Dispatch()
	jar, err := cookiejar.New(nil)
	if err != nil {
		h.t.Fatal(err)
	}
	c := &http.Client{Jar: jar}
	if r := h.Call(c, http.MethodPost, "/api/v1/session", map[string]string{"email": email, "password": Password}); r.Status != http.StatusNoContent {
		h.t.Fatalf("login status %d: %s", r.Status, r.Body)
	}
	return c
}

// Dispatch delivers every pending outbox event, as the dispatcher goroutine does in production.
func (h *Harness) Dispatch() {
	h.t.Helper()
	if _, err := h.App.Dispatcher.DispatchPending(h.t.Context()); err != nil {
		h.t.Fatal(err)
	}
}

type Response struct {
	Status int
	Body   []byte
}

func (r Response) Decode(t *testing.T, v any) {
	t.Helper()
	if err := json.Unmarshal(r.Body, v); err != nil {
		t.Fatalf("decode %s: %v", r.Body, err)
	}
}

func (h *Harness) Call(c *http.Client, method, path string, body any) Response {
	h.t.Helper()
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			h.t.Fatal(err)
		}
		reader = strings.NewReader(string(b))
	}
	req, err := http.NewRequestWithContext(h.t.Context(), method, h.server.URL+path, reader)
	if err != nil {
		h.t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.Do(req)
	if err != nil {
		h.t.Fatal(err)
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		h.t.Fatal(err)
	}
	return Response{Status: resp.StatusCode, Body: b}
}

func (h *Harness) Do(method, path string, body any) Response {
	h.t.Helper()
	return h.Call(h.Client, method, path, body)
}

// MustDo fails the test unless the response has status; out, when not nil, receives the body.
func (h *Harness) MustDo(method, path string, body any, status int, out any) {
	h.t.Helper()
	r := h.Do(method, path, body)
	if r.Status != status {
		h.t.Fatalf("%s %s = %d, want %d: %s", method, path, r.Status, status, r.Body)
	}
	if out != nil {
		r.Decode(h.t, out)
	}
}

// ExpectProblem checks an RFC 9457 response; field, when not empty, must be the first field error.
func (h *Harness) ExpectProblem(r Response, status int, code, field string) {
	h.t.Helper()
	if r.Status != status {
		h.t.Fatalf("status = %d, want %d: %s", r.Status, status, r.Body)
	}
	var p struct {
		Code   string `json:"code"`
		Errors []struct {
			Field string `json:"field"`
		} `json:"errors"`
	}
	r.Decode(h.t, &p)
	if p.Code != code {
		h.t.Fatalf("code = %q, want %q: %s", p.Code, code, r.Body)
	}
	if field != "" && (len(p.Errors) == 0 || p.Errors[0].Field != field) {
		h.t.Fatalf("field errors = %+v, want %q", p.Errors, field)
	}
}

// Account creates an account in BRL and returns its id.
func (h *Harness) Account(name, class, kind string, extra map[string]any) string {
	h.t.Helper()
	body := map[string]any{"name": name, "class": class, "currency": "BRL"}
	if kind != "" {
		body["kind"] = kind
	}
	for k, v := range extra {
		body[k] = v
	}
	var out struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/accounts", body, http.StatusCreated, &out)
	return out.ID
}

// Record posts a transaction and returns its id.
func (h *Harness) Record(date string, postings ...map[string]any) string {
	h.t.Helper()
	var out struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{"date": date, "description": "test", "postings": postings}, http.StatusCreated, &out)
	return out.ID
}

func BRL(amount int64) map[string]any { return map[string]any{"amount": amount, "currency": "BRL"} }

func Posting(account string, amount int64) map[string]any {
	return map[string]any{"account_id": account, "amount": BRL(amount)}
}
