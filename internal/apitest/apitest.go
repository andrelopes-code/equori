// Package apitest runs the application of internal/server against a test
// database and drives it over HTTP with a logged-in member.
package apitest

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/instance"
	"github.com/andrelopes-code/equori/internal/platform/logring"
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
	ring   *logring.Ring
	logs   *logBuffer
	// handler is what the test server runs; Restart swaps it while server goroutines read it.
	handler atomic.Pointer[http.Handler]
	// Profile is the language, region and base currency of the owner of New.
	Profile Profile
}

// New starts the application and logs in owner@example.com as Client.
func New(t testing.TB, opts ...Option) *Harness {
	t.Helper()
	h := Empty(t, opts...)
	h.Client = h.LoginAs("owner@example.com", h.Profile.Locale, h.Profile.Base)

	return h
}

// Empty is New without the owner: the instance has no member, as before the first-user setup.
func Empty(t testing.TB, opts ...Option) *Harness {
	t.Helper()

	logs := &logBuffer{}

	var out io.Writer = logs
	if os.Getenv("EQUORI_TEST_LOG") == "1" {
		out = io.MultiWriter(logs, os.Stderr)
	}

	ring := logring.New(slog.NewTextHandler(out, &slog.HandlerOptions{Level: slog.LevelDebug}), instance.LogRecordsKept, instance.LogKeys)
	h := &Harness{t: t, Pool: pgtest.New(t), logs: logs, ring: ring, log: slog.New(ring)}

	// BK17: a book without members, so a member ID never equals a books ID by chance.
	if _, err := h.Pool.Exec(t.Context(), `INSERT INTO identity_books (region, name) VALUES ('US', 'empty')`); err != nil {
		t.Fatal(err)
	}

	h.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { (*h.handler.Load()).ServeHTTP(w, r) }))
	t.Cleanup(h.server.Close)
	h.Profile = h.start(opts)

	return h
}

// Restart replaces the application on the same database and address, as a restart with
// another configuration does; sessions stay valid.
func (h *Harness) Restart(opts ...Option) {
	h.t.Helper()
	h.start(opts)
}

// Close stops the server after the requests in flight finish, so a test can read what a
// request left behind after its client went away; the harness serves no request afterwards.
func (h *Harness) Close() { h.server.Close() }

// Logger returns the logger the server writes through; the diagnostic file reads its warnings.
func (h *Harness) Logger() *slog.Logger { return h.log }

// Logs returns every log line written so far, at debug level and above.
func (h *Harness) Logs() string { return h.logs.String() }

// T returns the test the harness reports to.
func (h *Harness) T() testing.TB { return h.t }

// Dispatch delivers every pending outbox event, as the dispatcher goroutine does in production.
func (h *Harness) Dispatch() {
	h.t.Helper()

	if _, err := h.App.Dispatcher.DispatchPending(h.t.Context()); err != nil {
		h.t.Fatal(err)
	}
}

// start builds the application and returns the profile the options select.
func (h *Harness) start(opts []Option) Profile {
	h.t.Helper()

	o := options{profile: Brazil()}
	o.cfg.Instance.Log = h.ring.Records
	// argon2id at its production cost took a third of the ledger tests' time under -race.
	o.cfg.PasswordCost = identity.PasswordCost{MemoryKiB: 64, Iterations: 1}

	for _, apply := range opts {
		apply(&o)
	}

	app, err := server.New(h.Pool, o.cfg, h.log)
	if err != nil {
		h.t.Fatal(err)
	}

	if err := app.Marketdata.ReconcileCurrencies(h.t.Context()); err != nil {
		h.t.Fatal(err)
	}

	h.App = app
	h.handler.Store(&app.Handler)

	return o.profile
}
