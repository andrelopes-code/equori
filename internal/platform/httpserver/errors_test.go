package httpserver

import (
	"bytes"
	"encoding/json/v2"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/problem"
)

var errKnown = errors.New("known")

func TestErrorWriter(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		request bool
		err     error
		status  int
		code    string
		logged  bool
	}{
		{"module error", false, errKnown, 409, "known_conflict", false},
		{"wrapped module error", false, errors.Join(errors.New("context"), errKnown), 409, "known_conflict", false},
		{"transport error", false, &http.MaxBytesError{Limit: 1}, 413, "request_too_large", false},
		{"unknown error", false, errors.New("database down"), 500, "internal_error", true},
		{"malformed request", true, errors.New("decode body"), 400, "invalid_request", false},
		{"oversized request", true, &http.MaxBytesError{Limit: 1}, 413, "request_too_large", false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var logs bytes.Buffer
			ew := ErrorWriter{
				Log: slog.New(slog.NewJSONHandler(&logs, nil)),
				Map: func(err error) (problem.Details, bool) {
					if errors.Is(err, errKnown) {
						return problem.New(http.StatusConflict, "known_conflict", "known"), true
					}
					return problem.Details{}, false
				},
			}
			rec := httptest.NewRecorder()
			var h http.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tc.request {
					ew.WriteRequestError(w, r, tc.err)
				} else {
					ew.Write(w, r, tc.err)
				}
			})
			withRequestID(h).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/v1/x", nil))

			var d problem.Details
			if err := json.Unmarshal(rec.Body.Bytes(), &d); err != nil {
				t.Fatal(err)
			}
			if rec.Code != tc.status || d.Code != tc.code || d.RequestID == "" || d.RequestID != rec.Header().Get("X-Request-ID") {
				t.Fatalf("status %d: %s", rec.Code, rec.Body)
			}
			if tc.status >= 500 && (d.Detail != "" || strings.Contains(rec.Body.String(), "database down")) {
				t.Fatalf("internal error leaked: %s", rec.Body)
			}
			if logged := strings.Contains(logs.String(), d.RequestID); logged != tc.logged {
				t.Fatalf("logged = %v, want %v: %s", logged, tc.logged, logs.String())
			}
		})
	}
}
