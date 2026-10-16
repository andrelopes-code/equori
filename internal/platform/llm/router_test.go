package llm_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

var start = time.Date(2026, 10, 16, 12, 0, 0, 0, time.UTC)

// fixture holds a router whose clock the test moves.
type fixture struct {
	now    time.Time
	logs   bytes.Buffer
	router *llm.Router
}

func newFixture(providers ...llm.Provider) *fixture {
	f := &fixture{now: start}
	clk := clock.New(time.UTC, func() time.Time { return f.now })
	f.router = llm.NewRouter(&clk, slog.New(slog.NewJSONHandler(&f.logs, nil)), providers...)
	return f
}

func target(s string) llm.Target {
	p, m, _ := strings.Cut(s, "/")
	return llm.Target{Provider: p, Model: m}
}

func text(s string) llm.Response {
	return llm.Response{
		Message:      llm.Message{Role: llm.RoleModel, Parts: []llm.Part{{Text: s}}},
		FinishReason: llm.FinishStop,
		Usage:        llm.Usage{InputTokens: 3, OutputTokens: 5},
	}
}

func prompt() llm.Request {
	return llm.Request{Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{{Text: "secret prompt"}}}}}
}

func models(p *llmtest.Provider) []string {
	var out []string
	for _, c := range p.Requests() {
		out = append(out, c.Model)
	}
	return out
}

func TestClientGenerate(t *testing.T) {
	tests := []struct {
		name       string
		a, b       []llmtest.Step
		chain      []string
		wantTarget string
		wantErr    error
		wantCalls  int
	}{
		{
			name:       "first target answers",
			a:          []llmtest.Step{{Model: "m1", Response: text("ok")}},
			chain:      []string{"a/m1", "a/m2"},
			wantTarget: "a/m1",
			wantCalls:  1,
		},
		{
			name: "quota moves to next",
			a: []llmtest.Step{
				{Model: "m1", Err: &llm.QuotaError{RetryAfter: 30 * time.Second}},
				{Model: "m2", Response: text("ok")},
			},
			chain:      []string{"a/m1", "a/m2"},
			wantTarget: "a/m2",
			wantCalls:  2,
		},
		{
			name:       "transient moves to next",
			a:          []llmtest.Step{{Model: "m1", Err: fmt.Errorf("x: %w", llm.ErrTransient)}},
			b:          []llmtest.Step{{Model: "m1", Response: text("ok")}},
			chain:      []string{"a/m1", "b/m1"},
			wantTarget: "b/m1",
			wantCalls:  2,
		},
		{
			name:      "invalid stops",
			a:         []llmtest.Step{{Model: "m1", Err: fmt.Errorf("x: %w", llm.ErrInvalidRequest)}},
			chain:     []string{"a/m1", "a/m2"},
			wantErr:   llm.ErrInvalidRequest,
			wantCalls: 1,
		},
		{
			name:      "unauthorized stops",
			a:         []llmtest.Step{{Model: "m1", Err: fmt.Errorf("x: %w", llm.ErrUnauthorized)}},
			chain:     []string{"a/m1", "a/m2"},
			wantErr:   llm.ErrUnauthorized,
			wantCalls: 1,
		},
		{
			name:       "unregistered provider skipped",
			a:          []llmtest.Step{{Model: "m1", Response: text("ok")}},
			chain:      []string{"z/m1", "a/m1"},
			wantTarget: "a/m1",
			wantCalls:  1,
		},
		{
			name:    "no registered provider",
			chain:   []string{"z/m1"},
			wantErr: llm.ErrUnavailable,
		},
		{
			name:    "empty chain",
			wantErr: llm.ErrUnavailable,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a, b := llmtest.New("a", tt.a...), llmtest.New("b", tt.b...)
			f := newFixture(a, b)
			var chain []llm.Target
			for _, s := range tt.chain {
				chain = append(chain, target(s))
			}
			resp, err := f.router.Client(chain...).Generate(context.Background(), prompt())
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("err = %v, want %v", err, tt.wantErr)
				}
			} else {
				if err != nil {
					t.Fatalf("Generate: %v", err)
				}
				if resp.Target != target(tt.wantTarget) {
					t.Fatalf("Target = %v, want %s", resp.Target, tt.wantTarget)
				}
				if resp.Text() != "ok" {
					t.Fatalf("Text() = %q, want %q", resp.Text(), "ok")
				}
			}
			if got := len(a.Requests()) + len(b.Requests()); got != tt.wantCalls {
				t.Fatalf("calls = %d, want %d", got, tt.wantCalls)
			}
		})
	}
}

func TestClientExhausted(t *testing.T) {
	a := llmtest.New("a",
		llmtest.Step{Model: "m1", Err: &llm.QuotaError{RetryAfter: 30 * time.Second}},
		llmtest.Step{Model: "m2", Err: &llm.QuotaError{}},
	)
	f := newFixture(a)
	_, err := f.router.Client(target("a/m1"), target("a/m2")).Generate(context.Background(), prompt())
	var ex *llm.ExhaustedError
	if !errors.As(err, &ex) || !errors.Is(err, llm.ErrExhausted) {
		t.Fatalf("err = %v, want ExhaustedError", err)
	}
	if want := start.Add(30 * time.Second); !ex.RetryAt.Equal(want) {
		t.Fatalf("RetryAt = %v, want %v", ex.RetryAt, want)
	}
}

func TestClientCooldown(t *testing.T) {
	t.Run("quota with retry delay", func(t *testing.T) {
		a := llmtest.New("a",
			llmtest.Step{Model: "m1", Err: &llm.QuotaError{RetryAfter: 30 * time.Second}},
			llmtest.Step{Model: "m2", Response: text("ok")},
			llmtest.Step{Model: "m2", Response: text("ok")},
			llmtest.Step{Model: "m1", Response: text("ok")},
		)
		f := newFixture(a)
		c := f.router.Client(target("a/m1"), target("a/m2"))
		for _, offset := range []time.Duration{0, 29 * time.Second, 30 * time.Second} {
			f.now = start.Add(offset)
			if _, err := c.Generate(context.Background(), prompt()); err != nil {
				t.Fatalf("Generate at +%v: %v", offset, err)
			}
		}
		if got, want := models(a), []string{"m1", "m2", "m2", "m1"}; !slices.Equal(got, want) {
			t.Fatalf("models = %v, want %v", got, want)
		}
	})

	cases := []struct {
		name     string
		err      error
		cooldown time.Duration
	}{
		{"transient", fmt.Errorf("x: %w", llm.ErrTransient), 10 * time.Second},
		{"quota without retry delay", &llm.QuotaError{}, 60 * time.Second},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			a := llmtest.New("a",
				llmtest.Step{Model: "m1", Err: tt.err},
				llmtest.Step{Model: "m2", Response: text("ok")},
				llmtest.Step{Model: "m2", Response: text("ok")},
				llmtest.Step{Model: "m1", Response: text("ok")},
			)
			f := newFixture(a)
			c := f.router.Client(target("a/m1"), target("a/m2"))
			for _, offset := range []time.Duration{0, tt.cooldown - time.Second, tt.cooldown} {
				f.now = start.Add(offset)
				if _, err := c.Generate(context.Background(), prompt()); err != nil {
					t.Fatalf("Generate at +%v: %v", offset, err)
				}
			}
			if got, want := models(a), []string{"m1", "m2", "m2", "m1"}; !slices.Equal(got, want) {
				t.Fatalf("models = %v, want %v", got, want)
			}
		})
	}

	t.Run("shared across clients", func(t *testing.T) {
		a := llmtest.New("a",
			llmtest.Step{Model: "m1", Err: &llm.QuotaError{RetryAfter: time.Minute}},
			llmtest.Step{Model: "m2", Response: text("ok")},
			llmtest.Step{Model: "m3", Response: text("ok")},
		)
		f := newFixture(a)
		if _, err := f.router.Client(target("a/m1"), target("a/m2")).Generate(context.Background(), prompt()); err != nil {
			t.Fatal(err)
		}
		if _, err := f.router.Client(target("a/m1"), target("a/m3")).Generate(context.Background(), prompt()); err != nil {
			t.Fatal(err)
		}
		if got, want := models(a), []string{"m1", "m2", "m3"}; !slices.Equal(got, want) {
			t.Fatalf("models = %v, want %v", got, want)
		}
	})
}

func TestClientContextCancelled(t *testing.T) {
	a := llmtest.New("a",
		llmtest.Step{Model: "m1", Err: context.Canceled},
		llmtest.Step{Model: "m1", Response: text("ok")},
	)
	f := newFixture(a)
	c := f.router.Client(target("a/m1"), target("a/m2"))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := c.Generate(ctx, prompt()); !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
	resp, err := c.Generate(context.Background(), prompt())
	if err != nil {
		t.Fatalf("Generate after cancel: %v", err)
	}
	if resp.Target != target("a/m1") {
		t.Fatalf("Target = %v, want a/m1 without cooldown", resp.Target)
	}
}

// quotaFirst rejects m1 with a quota error and answers every other model; it is safe for
// concurrent use, unlike scripted llmtest steps.
type quotaFirst struct{}

func (quotaFirst) Name() string { return "a" }

func (quotaFirst) Generate(_ context.Context, model string, _ llm.Request) (llm.Response, error) {
	if model == "m1" {
		return llm.Response{}, &llm.QuotaError{RetryAfter: time.Minute}
	}
	return text("ok"), nil
}

func TestClientConcurrentCalls(t *testing.T) {
	f := newFixture(quotaFirst{})
	c := f.router.Client(target("a/m1"), target("a/m2"))
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			resp, err := c.Generate(context.Background(), prompt())
			if err == nil && resp.Target.Model != "m2" {
				err = fmt.Errorf("model = %s, want m2", resp.Target.Model)
			}
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestClientLogs(t *testing.T) {
	a := llmtest.New("a",
		llmtest.Step{Model: "m1", Err: &llm.QuotaError{RetryAfter: 30 * time.Second}},
		llmtest.Step{Model: "m2", Response: text("ok")},
	)
	f := newFixture(a)
	if _, err := f.router.Client(target("a/m1"), target("a/m2")).Generate(context.Background(), prompt()); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(f.logs.String(), "secret prompt") {
		t.Fatalf("logs contain message content: %s", f.logs.String())
	}
	var records []map[string]any
	for line := range strings.Lines(f.logs.String()) {
		var r map[string]any
		if err := json.Unmarshal([]byte(line), &r); err != nil {
			t.Fatalf("decode log %q: %v", line, err)
		}
		records = append(records, r)
	}
	want := []map[string]any{
		{"msg": "llm call", "level": "WARN", "provider": "a", "model": "m1", "outcome": "quota", "cooldown_until": "2026-10-16T12:00:30Z"},
		{"msg": "llm call", "level": "INFO", "provider": "a", "model": "m2", "outcome": "ok", "input_tokens": 3.0, "output_tokens": 5.0},
	}
	if len(records) != len(want) {
		t.Fatalf("records = %d, want %d: %s", len(records), len(want), f.logs.String())
	}
	for i, w := range want {
		for k, v := range w {
			if records[i][k] != v {
				t.Fatalf("record %d: %s = %v, want %v", i, k, records[i][k], v)
			}
		}
	}
}

func TestRouterProviders(t *testing.T) {
	f := newFixture(llmtest.New("b"), llmtest.New("a"))
	if got, want := f.router.Providers(), []string{"a", "b"}; !slices.Equal(got, want) {
		t.Fatalf("Providers() = %v, want %v", got, want)
	}
}
