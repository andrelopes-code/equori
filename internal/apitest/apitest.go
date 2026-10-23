// Package apitest runs the application of internal/server against a test
// database and drives it over HTTP with a logged-in user.
package apitest

import (
	"bytes"
	"encoding/json/v2"
	"io"
	"io/fs"
	"log/slog"
	"maps"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
	"github.com/andrelopes-code/equori/internal/server"
)

const Password = "correct horse battery"

type Harness struct {
	t      testing.TB
	Pool   *pgxpool.Pool
	App    *server.App
	server *httptest.Server
	Client *http.Client
	log    *slog.Logger
	logs   *logBuffer
	// handler is what the test server runs; Restart swaps it while server goroutines read it.
	handler atomic.Pointer[http.Handler]
}

// logBuffer keeps every log line of the test, for assertions on what is never logged.
type logBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *logBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *logBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

// Option changes the application the harness starts.
type Option func(*server.Config)

// Today fixes the instance clock at 12:00 UTC of date (YYYY-MM-DD).
func Today(date string) Option {
	d, err := time.Parse(time.DateOnly, date)
	if err != nil {
		panic(err)
	}
	clk := clock.New(time.UTC, func() time.Time { return d.Add(12 * time.Hour) })
	return func(c *server.Config) { c.Clock = &clk }
}

// LLM routes language model calls to providers, on the harness clock when Today came first.
func LLM(providers ...llm.Provider) Option {
	return func(c *server.Config) {
		clk := clock.New(time.UTC, time.Now)
		if c.Clock != nil {
			clk = *c.Clock
		}
		c.LLM = llm.NewRouter(&clk, slog.New(slog.DiscardHandler), providers...)
	}
}

// Web serves fsys as the single-page application outside /api/.
func Web(fsys fs.FS) Option {
	return func(c *server.Config) { c.Web = fsys }
}

// WebDevPort redirects pages to a Vite server on port of the request's host.
func WebDevPort(port int) Option {
	return func(c *server.Config) { c.WebDevPort = port }
}

// APIDocs serves the API reference at /docs and the contract at /openapi.yaml.
func APIDocs() Option {
	return func(c *server.Config) { c.APIDocs = true }
}

// SecretKey is the integration key Pluggy sets (32 bytes).
const SecretKey = "equori-test-secret-key-32-bytes!" //nolint:gosec // G101: a fixed key for test databases only

// Aggregator sends the requests of aggregator id to url and enables integrations with SecretKey.
func Aggregator(id, url string) Option {
	return func(c *server.Config) {
		if c.AggregatorURLs == nil {
			c.AggregatorURLs = map[string]string{}
		}
		c.AggregatorURLs[id], c.SecretKey = url, SecretKey
	}
}

// PriceFeeds enables the price feeds ids against the base URLs of a test server.
func PriceFeeds(ids []string, urls map[string]string) Option {
	return func(c *server.Config) { c.PriceFeeds, c.FeedURLs = ids, urls }
}

// IndexFeeds enables the index feeds ids against the base URLs of a test server.
func IndexFeeds(ids []string, urls map[string]string) Option {
	return func(c *server.Config) {
		c.IndexFeeds = ids
		if c.FeedURLs == nil {
			c.FeedURLs = map[string]string{}
		}
		maps.Copy(c.FeedURLs, urls)
	}
}

// SecretKeys replaces the integration keys; pass it after Aggregator.
func SecretKeys(current, previous string) Option {
	return func(c *server.Config) { c.SecretKey, c.PreviousSecretKey = current, previous }
}

// New starts the application and logs in owner@example.com as Client.
func New(t testing.TB, opts ...Option) *Harness {
	t.Helper()
	logs := &logBuffer{}
	var out io.Writer = logs
	if os.Getenv("EQUORI_TEST_LOG") == "1" {
		out = io.MultiWriter(logs, os.Stderr)
	}
	h := &Harness{t: t, Pool: pgtest.New(t), logs: logs, log: slog.New(slog.NewTextHandler(out, &slog.HandlerOptions{Level: slog.LevelDebug}))}
	h.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { (*h.handler.Load()).ServeHTTP(w, r) }))
	t.Cleanup(h.server.Close)
	h.start(opts)
	h.Client = h.Login("owner@example.com")
	return h
}

func (h *Harness) start(opts []Option) {
	h.t.Helper()
	cfg := server.Config{}
	for _, o := range opts {
		o(&cfg)
	}
	app, err := server.New(h.Pool, cfg, h.log)
	if err != nil {
		h.t.Fatal(err)
	}
	if err := app.Marketdata.ReconcileCurrencies(h.t.Context()); err != nil {
		h.t.Fatal(err)
	}
	h.App = app
	h.handler.Store(&app.Handler)
}

// Restart replaces the application on the same database and address, as a restart with
// another configuration does; sessions stay valid.
func (h *Harness) Restart(opts ...Option) {
	h.t.Helper()
	h.start(opts)
}

// Logs returns every log line written so far, at debug level and above.
func (h *Harness) Logs() string { return h.logs.String() }

// T returns the test the harness reports to.
func (h *Harness) T() testing.TB { return h.t }

// Login is LoginAs for a Brazilian user with BRL as base currency.
func (h *Harness) Login(email string) *http.Client {
	h.t.Helper()
	return h.LoginAs(email, locale.Locale{Language: "pt", Region: "BR"}, "BRL")
}

// LoginAs creates the user, runs the outbox so the ledger provisions it, and returns a client with its session.
func (h *Harness) LoginAs(email string, l locale.Locale, base money.Currency) *http.Client {
	h.t.Helper()
	if _, err := h.App.Identity.CreateUser(h.t.Context(), email, Password, identity.RoleAdmin, l, base); err != nil {
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

// OwnerID is the user ID of the harness client's account.
func (h *Harness) OwnerID() int64 {
	h.t.Helper()
	var id int64
	if err := h.Pool.QueryRow(h.t.Context(), `SELECT id FROM identity_user WHERE email = 'owner@example.com'`).Scan(&id); err != nil {
		h.t.Fatal(err)
	}
	return id
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
	Header http.Header
	Body   []byte
}

func (r Response) Decode(t testing.TB, v any) {
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
	return h.send(c, req)
}

// URL is the base URL of the test server, for requests the JSON helpers cannot build.
func (h *Harness) URL() string { return h.server.URL }

// Send executes a request built by the test with the given client.
func (h *Harness) Send(c *http.Client, req *http.Request) Response {
	h.t.Helper()
	return h.send(c, req)
}

func (h *Harness) send(c *http.Client, req *http.Request) Response {
	h.t.Helper()
	resp, err := c.Do(req) //nolint:gosec // tests address the harness's own httptest server
	if err != nil {
		h.t.Fatal(err)
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		h.t.Fatal(err)
	}
	return Response{Status: resp.StatusCode, Header: resp.Header, Body: b}
}

// Upload posts content as the multipart/form-data field "file".
func (h *Harness) Upload(path, fileName string, content []byte) Response {
	h.t.Helper()
	return h.UploadAs(h.Client, path, nil, fileName, content)
}

// UploadWith posts content as the field "file" with other form fields.
func (h *Harness) UploadWith(path string, fields map[string]string, fileName string, content []byte) Response {
	h.t.Helper()
	return h.UploadAs(h.Client, path, fields, fileName, content)
}

// UploadAs posts a multipart form with the given client.
func (h *Harness) UploadAs(c *http.Client, path string, fields map[string]string, fileName string, content []byte) Response {
	h.t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	for k, v := range fields {
		if err := w.WriteField(k, v); err != nil {
			h.t.Fatal(err)
		}
	}
	part, err := w.CreateFormFile("file", fileName)
	if err != nil {
		h.t.Fatal(err)
	}
	if _, err := part.Write(content); err != nil {
		h.t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		h.t.Fatal(err)
	}
	req, err := http.NewRequestWithContext(h.t.Context(), http.MethodPost, h.server.URL+path, &body)
	if err != nil {
		h.t.Fatal(err)
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	return h.send(c, req)
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

// Card creates a credit card account with a billing cycle rule from 2026-01.
func (h *Harness) Card(name string, closingDay, dueDay int, assignment string) string {
	h.t.Helper()
	id := h.Account(name, "liability", "credit_card", nil)
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+id+"/billing-cycle-rules", map[string]any{
		"effective_from": "2026-01", "closing_day": closingDay, "due_day": dueDay, "closing_day_assignment": assignment,
	}, http.StatusCreated, nil)
	return id
}

// Transaction returns the decoded transaction.
func (h *Harness) Transaction(id string) TransactionView {
	h.t.Helper()
	var out TransactionView
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+id, nil, http.StatusOK, &out)
	return out
}

type TransactionView struct {
	ID          string        `json:"id"`
	Version     int           `json:"version"`
	Date        string        `json:"date"`
	Description string        `json:"description"`
	Origin      string        `json:"origin"`
	Postings    []PostingView `json:"postings"`
}

type PostingView struct {
	ID        string `json:"id"`
	AccountID string `json:"account_id"`
	Amount    struct {
		Amount int64 `json:"amount"`
	} `json:"amount"`
	Statement   string `json:"statement"`
	Status      string `json:"status"`
	CardRole    string `json:"card_role"`
	Installment *struct {
		Number int    `json:"number"`
		Count  int    `json:"count"`
		PlanID string `json:"plan_id"`
	} `json:"installment"`
}
