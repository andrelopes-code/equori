package httpserver

import (
	"bytes"
	"encoding/json/v2"
	"log/slog"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/problem"
)

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

		attrs := []slog.Attr{
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Int("status", rw.status),
			slog.Int64("bytes", rw.bytes),
			slog.Duration("duration", time.Since(start)),
			slog.String("request_id", RequestID(r.Context())),
		}
		if d, ok := rw.problem(); ok {
			attrs = append(attrs, slog.Group("problem",
				slog.String("code", d.Code),
				slog.String("detail", d.Detail),
				slog.Any("errors", d.Errors),
			))
		}

		log.LogAttrs(r.Context(), level, "http request", attrs...)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status      int
	bytes       int64
	wroteHeader bool
	// body keeps the first maxLoggedBody bytes of an error response, which the access log decodes.
	body bytes.Buffer
}

// maxLoggedBody bounds the memory a failing response costs the access log; a larger body is not logged.
const maxLoggedBody = 8 << 10

// problem decodes the problem of an error response.
func (s *statusRecorder) problem() (problem.Details, bool) {
	var d problem.Details
	if s.status < http.StatusBadRequest || s.Header().Get("Content-Type") != problem.ContentType {
		return d, false
	}

	return d, json.Unmarshal(s.body.Bytes(), &d) == nil
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

	if s.status >= http.StatusBadRequest && s.body.Len()+n <= maxLoggedBody {
		s.body.Write(b[:n])
	}

	return n, err
}

// Unwrap lets http.ResponseController reach the underlying writer.
func (s *statusRecorder) Unwrap() http.ResponseWriter { return s.ResponseWriter }
