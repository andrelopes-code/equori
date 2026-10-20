package aistudio_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/aistudio"
)

func generate(ctx context.Context, p *aistudio.Provider) error {
	_, err := p.Generate(ctx, "gemini-x", llm.Request{Messages: []llm.Message{user("hi")}})
	return err
}

func TestGenerateErrors(t *testing.T) {
	t.Parallel()
	quota := func(want time.Duration) func(*testing.T, error) {
		return func(t *testing.T, err error) {
			var q *llm.QuotaError
			if !errors.As(err, &q) || !errors.Is(err, llm.ErrQuota) {
				t.Fatalf("err = %v, want QuotaError", err)
			}
			if q.RetryAfter != want {
				t.Fatalf("RetryAfter = %v, want %v", q.RetryAfter, want)
			}
		}
	}
	is := func(want error, contains string) func(*testing.T, error) {
		return func(t *testing.T, err error) {
			if !errors.Is(err, want) {
				t.Fatalf("err = %v, want %v", err, want)
			}
			if !strings.Contains(err.Error(), contains) {
				t.Fatalf("err = %q, want it to contain %q", err, contains)
			}
		}
	}
	tests := []struct {
		name    string
		status  int
		fixture string
		check   func(*testing.T, error)
	}{
		{"quota with retry delay", 429, "error_quota.json", quota(37 * time.Second)},
		{"quota with fractional delay", 429, "error_quota_fraction.json", quota(500 * time.Millisecond)},
		{"quota without retry info", 429, "error_quota_no_retry.json", quota(0)},
		{"quota with a body that is not json", 429, "error_not_json.txt", quota(0)},
		{"bad request", 400, "error_invalid.json", is(llm.ErrInvalidRequest, "Invalid JSON payload received.")},
		{"unknown model", 404, "error_invalid.json", is(llm.ErrInvalidRequest, "Invalid JSON payload received.")},
		{"bad key", 401, "error_unauthorized.json", is(llm.ErrUnauthorized, "status 401")},
		{"forbidden", 403, "error_unauthorized.json", is(llm.ErrUnauthorized, "status 403")},
		{"internal error", 500, "error_server.json", is(llm.ErrTransient, "status 500")},
		{"bad gateway", 502, "error_server.json", is(llm.ErrTransient, "status 502")},
		{"overloaded", 503, "error_server.json", is(llm.ErrTransient, "status 503")},
		{"gateway timeout", 504, "error_server.json", is(llm.ErrTransient, "status 504")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := serve(t, tt.status, tt.fixture, nil)
			tt.check(t, generate(context.Background(), aistudio.New(srv.URL, "k", srv.Client())))
		})
	}

	t.Run("server unreachable", func(t *testing.T) {
		srv := httptest.NewServer(http.NotFoundHandler())
		srv.Close()
		if err := generate(context.Background(), aistudio.New(srv.URL, "k", http.DefaultClient)); !errors.Is(err, llm.ErrTransient) {
			t.Fatalf("err = %v, want ErrTransient", err)
		}
	})

	t.Run("client timeout", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			// The server notices the client leaving only once the body is consumed.
			_, _ = io.Copy(io.Discard, r.Body)
			<-r.Context().Done()
		}))
		t.Cleanup(srv.Close)
		p := aistudio.New(srv.URL, "k", &http.Client{Timeout: 50 * time.Millisecond})
		if err := generate(context.Background(), p); !errors.Is(err, llm.ErrTransient) {
			t.Fatalf("err = %v, want ErrTransient", err)
		}
	})

	t.Run("caller context cancelled", func(t *testing.T) {
		srv := serve(t, http.StatusOK, "text.json", nil)
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		err := generate(ctx, aistudio.New(srv.URL, "k", srv.Client()))
		if !errors.Is(err, context.Canceled) || errors.Is(err, llm.ErrTransient) {
			t.Fatalf("err = %v, want context.Canceled only", err)
		}
	})
}

func TestKeyNeverExposed(t *testing.T) {
	t.Parallel()
	const key = "AIzaTESTKEY"
	closed := httptest.NewServer(http.NotFoundHandler())
	closed.Close()
	tests := []struct {
		name string
		url  func(t *testing.T) string
	}{
		{"unauthorized", func(t *testing.T) string { return serve(t, 401, "error_unauthorized.json", nil).URL }},
		{"quota", func(t *testing.T) string { return serve(t, 429, "error_quota.json", nil).URL }},
		{"server unreachable", func(*testing.T) string { return closed.URL }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var logs bytes.Buffer
			clk := clock.New(time.UTC, func() time.Time { return time.Date(2026, 10, 16, 12, 0, 0, 0, time.UTC) })
			router := llm.NewRouter(&clk, slog.New(slog.NewJSONHandler(&logs, nil)), aistudio.New(tt.url(t), key, http.DefaultClient))
			_, err := router.Client(llm.Target{Provider: "aistudio", Model: "gemini-x"}).Generate(context.Background(), llm.Request{Messages: []llm.Message{user("hi")}})
			if err == nil {
				t.Fatal("Generate succeeded, want an error")
			}
			if strings.Contains(err.Error(), key) || strings.Contains(logs.String(), key) {
				t.Fatalf("key exposed: err %q, logs %s", err, logs.String())
			}
			if logs.Len() == 0 {
				t.Fatal("no log record written")
			}
		})
	}
}
