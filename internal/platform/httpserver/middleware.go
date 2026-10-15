package httpserver

import (
	"context"
	"crypto/rand"
	"log/slog"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/problem"
)

type requestIDKey struct{}

func RequestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

const maxBodyBytes = 1 << 20

// BodyLimit replaces the 1 MiB body limit for the requests an http.ServeMux pattern matches.
type BodyLimit struct {
	Pattern string
	Bytes   int64
}

// Middleware wraps h with, from outermost to innermost: request ID, security headers,
// access log, panic recovery, cross-origin protection (CSRF defense, ADR 003) and the body limit.
func Middleware(h http.Handler, log *slog.Logger, limits ...BodyLimit) http.Handler {
	h = limitBody(h, limits)
	h = http.NewCrossOriginProtection().Handler(h)
	h = recoverPanic(h, log)
	h = accessLog(h, log)
	h = securityHeaders(h)
	return withRequestID(h)
}

// securityHeaders are set before the handler runs, so every response carries them,
// including problems written by the middleware itself (ADR 007, C9).
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
			h.Set("Cache-Control", "no-store")
		}
		next.ServeHTTP(w, r)
	})
}

// withRequestID always generates the ID; an incoming X-Request-ID is not trusted.
func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := rand.Text()
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey{}, id)))
	})
}

func limitBody(next http.Handler, limits []BodyLimit) http.Handler {
	routes := http.NewServeMux()
	bytes := make(map[string]int64, len(limits))
	for _, l := range limits {
		routes.Handle(l.Pattern, next)
		bytes[l.Pattern] = l.Bytes
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limit := int64(maxBodyBytes)
		if _, pattern := routes.Handler(r); pattern != "" {
			limit = bytes[pattern]
		}
		r.Body = http.MaxBytesReader(w, r.Body, limit)
		next.ServeHTTP(w, r)
	})
}

// NotFound answers unmatched /api/ routes, so API clients always receive ADR 004 problems.
func NotFound() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		d := problem.New(http.StatusNotFound, "not_found", "no endpoint matches "+r.Method+" "+r.URL.Path)
		d.RequestID = RequestID(r.Context())
		problem.Write(w, d)
	})
}

func accessLog(next http.Handler, log *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rw, r)
		level := slog.LevelInfo
		if r.URL.Path == "/healthz" {
			// The container HEALTHCHECK polls every 10 s.
			level = slog.LevelDebug
		}
		log.LogAttrs(r.Context(), level, "http request",
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Int("status", rw.status),
			slog.Int64("bytes", rw.bytes),
			slog.Duration("duration", time.Since(start)),
			slog.String("request_id", RequestID(r.Context())),
		)
	})
}

func recoverPanic(next http.Handler, log *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			v := recover()
			if v == nil {
				return
			}
			// http.ErrAbortHandler is the stdlib signal to abort the response silently.
			if v == http.ErrAbortHandler { //nolint:errorlint // recover() value, not a wrapped error.
				panic(v)
			}
			id := RequestID(r.Context())
			log.ErrorContext(r.Context(), "panic serving request",
				"panic", v, "request_id", id, "stack", string(debug.Stack()))
			d := problem.New(http.StatusInternalServerError, "internal_error", "")
			d.RequestID = id
			problem.Write(w, d)
		}()
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status      int
	bytes       int64
	wroteHeader bool
}

func (s *statusRecorder) WriteHeader(code int) {
	if !s.wroteHeader {
		s.status = code
		s.wroteHeader = true
	}
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Write(b []byte) (int, error) {
	s.wroteHeader = true
	n, err := s.ResponseWriter.Write(b)
	s.bytes += int64(n)
	return n, err
}

// Unwrap lets http.ResponseController reach the underlying writer.
func (s *statusRecorder) Unwrap() http.ResponseWriter { return s.ResponseWriter }
