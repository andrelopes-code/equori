package httpserver

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/problem"
)

func serve(t *testing.T, h http.Handler, req *http.Request) (*httptest.ResponseRecorder, string) {
	t.Helper()
	var logs bytes.Buffer
	rec := httptest.NewRecorder()
	Middleware(h, slog.New(slog.NewJSONHandler(&logs, nil))).ServeHTTP(rec, req)
	return rec, logs.String()
}

func TestMiddlewareRequestID(t *testing.T) {
	t.Parallel()
	var seen string
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { seen = RequestID(r.Context()) })
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	req.Header.Set("X-Request-ID", "client-supplied")

	rec, logs := serve(t, h, req)

	got := rec.Header().Get("X-Request-ID")
	if got == "" || got == "client-supplied" {
		t.Fatalf("X-Request-ID = %q, want a generated ID", got)
	}
	if seen != got {
		t.Fatalf("context request ID = %q, header = %q", seen, got)
	}
	if !strings.Contains(logs, `"request_id":"`+got+`"`) {
		t.Fatalf("access log lacks request_id: %s", logs)
	}
}

func TestMiddlewareAccessLogStatus(t *testing.T) {
	t.Parallel()
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		_, _ = io.WriteString(w, "abc")
	})
	_, logs := serve(t, h, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/x", nil))

	for _, want := range []string{`"status":418`, `"bytes":3`, `"path":"/x"`} {
		if !strings.Contains(logs, want) {
			t.Errorf("access log lacks %s: %s", want, logs)
		}
	}
}

func TestMiddlewareRecoversPanic(t *testing.T) {
	t.Parallel()
	h := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") })
	rec, logs := serve(t, h, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != problem.ContentType {
		t.Fatalf("content type = %q", ct)
	}
	if strings.Contains(rec.Body.String(), "boom") {
		t.Fatalf("panic value leaked to client: %s", rec.Body.String())
	}
	if !strings.Contains(logs, "panic serving request") {
		t.Fatalf("panic not logged: %s", logs)
	}
}

func TestMiddlewareRejectsCrossOriginWrite(t *testing.T) {
	t.Parallel()
	called := false
	h := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { called = true })
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/v1/x", nil)
	req.Header.Set("Sec-Fetch-Site", "cross-site")

	rec, _ := serve(t, h, req)

	if called || rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, handler called = %v; want 403 and not called", rec.Code, called)
	}
}

func TestMiddlewareLimitsBody(t *testing.T) {
	t.Parallel()
	var readErr error
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, readErr = io.ReadAll(r.Body) })
	body := strings.NewReader(strings.Repeat("a", maxBodyBytes+1))

	serve(t, h, httptest.NewRequestWithContext(t.Context(), http.MethodPut, "/", body))

	if _, ok := problem.Transport(readErr); !ok {
		t.Fatalf("read err = %v, want a transport error for an oversized body", readErr)
	}
}

func TestMiddlewareRaisesBodyLimitForRoute(t *testing.T) {
	t.Parallel()
	limits := []BodyLimit{{Pattern: "POST /files/{id}", Bytes: 2 * maxBodyBytes}}
	tests := []struct {
		name, method, path string
		size               int
		rejected           bool
	}{
		{"raised route within its limit", http.MethodPost, "/files/1", 2 * maxBodyBytes, false},
		{"raised route above its limit", http.MethodPost, "/files/1", 2*maxBodyBytes + 1, true},
		{"other method keeps the default", http.MethodPut, "/files/1", maxBodyBytes + 1, true},
		{"other path keeps the default", http.MethodPost, "/other", maxBodyBytes + 1, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var readErr error
			h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, readErr = io.ReadAll(r.Body) })
			req := httptest.NewRequestWithContext(t.Context(), tc.method, tc.path, strings.NewReader(strings.Repeat("a", tc.size)))
			Middleware(h, slog.New(slog.DiscardHandler), limits...).ServeHTTP(httptest.NewRecorder(), req)
			if _, rejected := problem.Transport(readErr); rejected != tc.rejected {
				t.Fatalf("rejected = %v, want %v (err %v)", rejected, tc.rejected, readErr)
			}
		})
	}
}

func TestNotFound(t *testing.T) {
	t.Parallel()
	rec, _ := serve(t, NotFound(), httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/v1/nope", nil))

	if rec.Code != http.StatusNotFound || rec.Header().Get("Content-Type") != problem.ContentType {
		t.Fatalf("status = %d, content type = %q; want 404 problem", rec.Code, rec.Header().Get("Content-Type"))
	}
	if !strings.Contains(rec.Body.String(), `"code":"not_found"`) || !strings.Contains(rec.Body.String(), `"request_id":"`) {
		t.Fatalf("body = %s", rec.Body.String())
	}
}

// ADR 007, C9; ADR 028 for non-API responses.
func TestMiddlewareSetsSecurityHeaders(t *testing.T) {
	t.Parallel()
	common := map[string]string{"X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"}
	byKind := map[bool]map[string]string{
		true: {"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "Cache-Control": "no-store"},
		false: {
			"Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
			"Cache-Control":           "",
		},
	}
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte("ok")) })
	failing := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		problem.Write(w, problem.New(http.StatusConflict, "conflict", "conflict"))
	})
	panicking := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { panic("boom") })
	tests := []struct {
		name string
		h    http.Handler
		path string
		api  bool
	}{
		{"api success", ok, "/api/v1/accounts", true},
		{"api problem", failing, "/api/v1/accounts", true},
		{"api not found", NotFound(), "/api/v1/nope", true},
		{"api panic", panicking, "/api/v1/accounts", true},
		{"non-api", ok, "/healthz", false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec, _ := serve(t, tc.h, httptest.NewRequestWithContext(t.Context(), http.MethodGet, tc.path, nil))
			for k, v := range common {
				if got := rec.Header().Get(k); got != v {
					t.Errorf("%s = %q, want %q", k, got, v)
				}
			}
			for k, want := range byKind[tc.api] {
				if got := rec.Header().Get(k); got != want {
					t.Errorf("%s = %q, want %q", k, got, want)
				}
			}
		})
	}
}
