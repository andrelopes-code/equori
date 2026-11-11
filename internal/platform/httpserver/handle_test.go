package httpserver_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

type echoIn struct {
	Name string `json:"name"`
}

type echoOut struct {
	Greeting string `json:"greeting"`
}

func TestHandle(t *testing.T) {
	errBoom := errors.New("boom")
	writer := httpserver.ErrorWriter{
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		Map: func(err error) (problem.Details, bool) {
			if errors.Is(err, errBoom) {
				return problem.New(http.StatusUnprocessableEntity, "boom", "boom"), true
			}

			return problem.Details{}, false
		},
	}

	tests := []struct {
		name       string
		body       string
		fn         func(context.Context, echoIn) (echoOut, error)
		wantStatus int
		wantBody   string
	}{
		{
			name:       "writes the result with the given status",
			body:       `{"name":"ana"}`,
			fn:         func(_ context.Context, in echoIn) (echoOut, error) { return echoOut{"hi " + in.Name}, nil },
			wantStatus: http.StatusCreated,
			wantBody:   `{"greeting":"hi ana"}` + "\n",
		},
		{
			name:       "answers 400 for a malformed body",
			body:       `{`,
			fn:         func(context.Context, echoIn) (echoOut, error) { return echoOut{}, nil },
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "maps an error of the function",
			body:       `{}`,
			fn:         func(context.Context, echoIn) (echoOut, error) { return echoOut{}, errBoom },
			wantStatus: http.StatusUnprocessableEntity,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/x", strings.NewReader(tt.body))

			httpserver.Handle(writer, http.StatusCreated, tt.fn)(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}

			if tt.wantBody != "" && rec.Body.String() != tt.wantBody {
				t.Errorf("body = %q, want %q", rec.Body.String(), tt.wantBody)
			}
		})
	}
}
