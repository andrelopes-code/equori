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

func TestHandleCreated(t *testing.T) {
	errBoom := errors.New("boom")
	writer := createdWriter(errBoom)

	tests := []struct {
		name         string
		body         string
		fn           func(context.Context, *http.Request, echoIn) (echoOut, string, error)
		wantStatus   int
		wantLocation string
		wantBody     string
	}{
		{
			name: "answers 201 with the body and the Location header",
			body: `{"name":"ana"}`,
			fn: func(_ context.Context, _ *http.Request, in echoIn) (echoOut, string, error) {
				return echoOut{"hi " + in.Name}, "/api/v1/greetings/1", nil
			},
			wantStatus:   http.StatusCreated,
			wantLocation: "/api/v1/greetings/1",
			wantBody:     `{"greeting":"hi ana"}` + "\n",
		},
		{
			name: "answers 400 for a malformed body",
			body: `{`,
			fn: func(context.Context, *http.Request, echoIn) (echoOut, string, error) {
				return echoOut{}, "/x", nil
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "maps an error of the function",
			body: `{}`,
			fn: func(context.Context, *http.Request, echoIn) (echoOut, string, error) {
				return echoOut{}, "/x", errBoom
			},
			wantStatus: http.StatusUnprocessableEntity,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(
				t.Context(),
				http.MethodPost,
				"/x",
				strings.NewReader(tt.body),
			)

			httpserver.HandleCreated(writer, tt.fn)(rec, req)

			assertCreated(t, rec, tt.wantStatus, tt.wantLocation, tt.wantBody)
		})
	}
}

func TestWriteCreated(t *testing.T) {
	writer := createdWriter(errors.New("boom"))

	tests := []struct {
		name         string
		body         any
		wantStatus   int
		wantLocation string
		wantBody     string
	}{
		{
			name:         "answers 201 with the body and the Location header",
			body:         echoOut{"hi"},
			wantStatus:   http.StatusCreated,
			wantLocation: "/api/v1/greetings/2",
			wantBody:     `{"greeting":"hi"}` + "\n",
		},
		{
			name:       "maps an encoding error without a Location header",
			body:       make(chan int),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/x", nil)

			httpserver.WriteCreated(writer, rec, req, "/api/v1/greetings/2", tt.body)

			assertCreated(t, rec, tt.wantStatus, tt.wantLocation, tt.wantBody)
		})
	}
}

func createdWriter(errBoom error) httpserver.ErrorWriter {
	return httpserver.ErrorWriter{
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		Map: func(err error) (problem.Details, bool) {
			if errors.Is(err, errBoom) {
				return problem.New(http.StatusUnprocessableEntity, "boom", "boom"), true
			}

			return problem.Details{}, false
		},
	}
}

func assertCreated(
	t *testing.T,
	rec *httptest.ResponseRecorder,
	status int,
	location, body string,
) {
	t.Helper()

	if rec.Code != status {
		t.Fatalf("status = %d, want %d", rec.Code, status)
	}

	if got := rec.Header().Get("Location"); got != location {
		t.Errorf("Location = %q, want %q", got, location)
	}

	if body != "" && rec.Body.String() != body {
		t.Errorf("body = %q, want %q", rec.Body.String(), body)
	}
}
