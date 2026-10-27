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
	return newResolvingFixture(nil, providers...)
}

func newResolvingFixture(res llm.Resolver, providers ...llm.Provider) *fixture {
	f := &fixture{now: start}
	clk := clock.New(time.UTC, func() time.Time { return f.now })
	f.router = llm.NewRouter(&clk, slog.New(slog.NewJSONHandler(&f.logs, nil)), res, providers...)
	return f
}

// resolver answers every use with its bindings, or with err.
type resolver struct {
	bindings []llm.Binding
	err      error
	uses     []string
}

func (r *resolver) Resolve(_ context.Context, u llm.Use) ([]llm.Binding, error) {
	r.uses = append(r.uses, u.ID)
	return r.bindings, r.err
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
	t.Parallel()
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
	t.Parallel()
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
	t.Parallel()
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
	t.Parallel()
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
	t.Parallel()
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
	t.Parallel()
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

func TestClientMalformedOutput(t *testing.T) {
	t.Parallel()
	parts := func(texts ...string) []llm.Part {
		var ps []llm.Part
		for _, s := range texts {
			ps = append(ps, llm.Part{Text: s})
		}
		return ps
	}
	tests := []struct {
		name    string
		schema  json.RawMessage
		parts   []llm.Part
		finish  llm.FinishReason
		wantErr error
	}{
		{"valid json", json.RawMessage(`{"type":"object"}`), parts(`{"a":1}`), llm.FinishStop, nil},
		{"json split over parts", json.RawMessage(`{"type":"object"}`), parts(`{"a":`, `1}`), llm.FinishStop, nil},
		{"truncated json", json.RawMessage(`{"type":"object"}`), parts(`{"a":`), llm.FinishLength, llm.ErrMalformedOutput},
		{"free text is not checked", nil, parts(`{"a":`), llm.FinishStop, nil},
		{"tool call step is not checked", json.RawMessage(`{"type":"object"}`), []llm.Part{{ToolCall: &llm.ToolCall{ID: "c1", Name: "balance"}}}, llm.FinishToolCalls, nil},
		{"blocked answer is not checked", json.RawMessage(`{"type":"object"}`), nil, llm.FinishBlocked, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := llm.Response{Message: llm.Message{Role: llm.RoleModel, Parts: tt.parts}, FinishReason: tt.finish}
			a := llmtest.New("a", llmtest.Step{Model: "m1", Response: resp})
			f := newFixture(a)
			req := prompt()
			req.Schema = tt.schema
			_, err := f.router.Client(target("a/m1"), target("a/m2")).Generate(context.Background(), req)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if got := len(a.Requests()); got != 1 {
				t.Fatalf("calls = %d, want 1", got)
			}
		})
	}
}

func TestRouterProviders(t *testing.T) {
	t.Parallel()
	f := newFixture(llmtest.New("b"), llmtest.New("a"))
	if got, want := f.router.Providers(), []string{"a", "b"}; !slices.Equal(got, want) {
		t.Fatalf("Providers() = %v, want %v", got, want)
	}
}

var chatUse = llm.Use{ID: "test.chat", Needs: []llm.Capability{llm.CapTools}}

func TestClientUse(t *testing.T) {
	t.Parallel()
	a := llmtest.New("openai", llmtest.Step{Model: "m1", Err: &llm.QuotaError{RetryAfter: 30 * time.Second}})
	b := llmtest.New("openai", llmtest.Step{Model: "m1", Response: text("ok")}, llmtest.Step{Model: "m1", Response: text("ok")})
	res := &resolver{bindings: []llm.Binding{{Target: target("u1/m1"), Provider: a}, {Target: target("u2/m1"), Provider: b}}}
	f := newResolvingFixture(res)
	client := f.router.Use(chatUse)
	for range 2 {
		resp, err := client.Generate(context.Background(), prompt())
		if err != nil {
			t.Fatalf("Generate: %v", err)
		}
		if resp.Target != target("u2/m1") {
			t.Fatalf("Target = %v, want u2/m1", resp.Target)
		}
	}
	if got := len(a.Requests()); got != 1 {
		t.Fatalf("calls to the cooling target = %d, want 1", got)
	}
	if !slices.Equal(res.uses, []string{"test.chat", "test.chat"}) {
		t.Fatalf("resolved uses = %v, want two test.chat", res.uses)
	}
}

func TestClientUseUnavailable(t *testing.T) {
	t.Parallel()
	sentinel := errors.New("resolve failed")
	tests := []struct {
		name    string
		res     llm.Resolver
		wantErr error
	}{
		{name: "resolver error", res: &resolver{err: sentinel}, wantErr: sentinel},
		{name: "no binding", res: &resolver{}, wantErr: llm.ErrUnavailable},
		{name: "no resolver", wantErr: llm.ErrUnavailable},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := newResolvingFixture(tt.res, llmtest.New("a"))
			_, err := f.router.Use(chatUse).Generate(context.Background(), prompt())
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

// recordingResolver is a resolver that also records attempts (ADR 019 U1).
type recordingResolver struct {
	resolver
	attempts []llm.Attempt
}

func (r *recordingResolver) Record(_ context.Context, a llm.Attempt) {
	r.attempts = append(r.attempts, a)
}

func TestClientUseRecords(t *testing.T) {
	t.Parallel()
	a := llmtest.New("openai", llmtest.Step{Model: "m1", Err: &llm.QuotaError{RetryAfter: 30 * time.Second}})
	b := llmtest.New("openai", llmtest.Step{Model: "m1", Response: text("ok")})
	res := &recordingResolver{resolver: resolver{bindings: []llm.Binding{{Target: target("u1/m1"), Provider: a}, {Target: target("u2/m1"), Provider: b}}}}
	f := newResolvingFixture(res)
	if _, err := f.router.Use(chatUse).Generate(context.Background(), prompt()); err != nil {
		t.Fatalf("Generate: %v", err)
	}
	want := []llm.Attempt{
		{Use: "test.chat", Target: target("u1/m1"), Outcome: "quota", CooldownUntil: start.Add(30 * time.Second)},
		{Use: "test.chat", Target: target("u2/m1"), Outcome: "ok", Usage: llm.Usage{InputTokens: 3, OutputTokens: 5}},
	}
	if !slices.Equal(res.attempts, want) {
		t.Fatalf("attempts = %+v\nwant       %+v", res.attempts, want)
	}

	fixed := newResolvingFixture(res, llmtest.New("c", llmtest.Step{Model: "m", Response: text("ok")}))
	if _, err := fixed.router.Client(target("c/m")).Generate(context.Background(), prompt()); err != nil {
		t.Fatalf("fixed chain: %v", err)
	}
	if len(res.attempts) != 2 {
		t.Fatalf("a fixed chain recorded %d attempts", len(res.attempts)-2)
	}
}

func TestClientPin(t *testing.T) {
	t.Parallel()
	a := llmtest.New("a")
	b := llmtest.New("b", llmtest.Step{Model: "m1", Response: text("from b")})
	f := newFixture(a, b)
	req := prompt()
	req.Pin = target("b/m1")
	resp, err := f.router.Client(target("a/m1"), target("b/m1")).Generate(context.Background(), req)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if resp.Target != target("b/m1") || len(a.Requests()) != 0 {
		t.Fatalf("Target = %v, calls to a = %d", resp.Target, len(a.Requests()))
	}
}

func TestClientPinCooling(t *testing.T) {
	t.Parallel()
	a := llmtest.New("a", llmtest.Step{Model: "m1", Err: &llm.QuotaError{RetryAfter: time.Minute}})
	b := llmtest.New("b")
	f := newFixture(a, b)
	client := f.router.Client(target("a/m1"))
	if _, err := client.Generate(context.Background(), prompt()); !errors.Is(err, llm.ErrExhausted) {
		t.Fatalf("first err = %v, want ErrExhausted", err)
	}
	req := prompt()
	req.Pin = target("a/m1")
	_, err := f.router.Client(target("a/m1"), target("b/m1")).Generate(context.Background(), req)
	if !errors.Is(err, llm.ErrExhausted) {
		t.Fatalf("err = %v, want ErrExhausted", err)
	}
	if len(b.Requests()) != 0 {
		t.Fatalf("calls to b = %d, want 0", len(b.Requests()))
	}
}

// gated answers its calls with the next function of calls, in call order.
type gated struct {
	mu    sync.Mutex
	calls []func() (llm.Response, error)
}

func (*gated) Name() string { return "g" }

func (g *gated) Generate(context.Context, string, llm.Request) (llm.Response, error) {
	g.mu.Lock()
	next := g.calls[0]
	g.calls = g.calls[1:]
	g.mu.Unlock()
	return next()
}

// Design 2026-10-26 E6, E7: an exhausted chain reports whether only transient cooldowns block it.
func TestExhaustedTransient(t *testing.T) {
	t.Parallel()
	transient := fmt.Errorf("x: %w", llm.ErrTransient)
	exhausted := func(t *testing.T, err error) *llm.ExhaustedError {
		t.Helper()
		ex, ok := errors.AsType[*llm.ExhaustedError](err)
		if !ok {
			t.Fatalf("err = %v, want ExhaustedError", err)
		}
		return ex
	}
	t.Run("transient", func(t *testing.T) {
		t.Parallel()
		f := newFixture(llmtest.New("a", llmtest.Step{Model: "m1", Err: transient}))
		_, err := f.router.Client(target("a/m1")).Generate(context.Background(), prompt())
		if ex := exhausted(t, err); !ex.Transient || !ex.RetryAt.Equal(start.Add(10*time.Second)) {
			t.Fatalf("ExhaustedError = %+v, want transient until +10s", ex)
		}
	})
	t.Run("quota", func(t *testing.T) {
		t.Parallel()
		f := newFixture(llmtest.New("a", llmtest.Step{Model: "m1", Err: &llm.QuotaError{RetryAfter: time.Minute}}))
		_, err := f.router.Client(target("a/m1")).Generate(context.Background(), prompt())
		if ex := exhausted(t, err); ex.Transient {
			t.Fatalf("ExhaustedError = %+v, want quota", ex)
		}
	})
	t.Run("a quota cooldown on a skipped target blocks", func(t *testing.T) {
		t.Parallel()
		a := llmtest.New("a", llmtest.Step{Model: "m1", Err: &llm.QuotaError{}})
		b := llmtest.New("b", llmtest.Step{Model: "m1", Response: text("ok")}, llmtest.Step{Model: "m1", Err: transient})
		f := newFixture(a, b)
		c := f.router.Client(target("a/m1"), target("b/m1"))
		if _, err := c.Generate(context.Background(), prompt()); err != nil {
			t.Fatal(err)
		}
		f.now = start.Add(time.Second)
		_, err := c.Generate(context.Background(), prompt())
		if ex := exhausted(t, err); ex.Transient {
			t.Fatalf("ExhaustedError = %+v, want quota", ex)
		}
	})
	// Review Focus 3: a transient failure that ends after a running quota cooldown keeps it a quota cooldown.
	t.Run("transient over a running quota cooldown", func(t *testing.T) {
		t.Parallel()
		entered, release := make(chan struct{}), make(chan struct{})
		g := &gated{calls: []func() (llm.Response, error){
			func() (llm.Response, error) { close(entered); <-release; return llm.Response{}, transient },
			func() (llm.Response, error) { return llm.Response{}, &llm.QuotaError{RetryAfter: 5 * time.Second} },
		}}
		f := newFixture(g)
		c := f.router.Client(target("g/m1"))
		done := make(chan error)
		go func() {
			_, err := c.Generate(context.Background(), prompt())
			done <- err
		}()
		<-entered
		if _, err := c.Generate(context.Background(), prompt()); !errors.Is(err, llm.ErrExhausted) {
			t.Fatalf("quota call err = %v", err)
		}
		close(release)
		if ex := exhausted(t, <-done); ex.Transient || !ex.RetryAt.Equal(start.Add(10*time.Second)) {
			t.Fatalf("ExhaustedError = %+v, want quota until +10s", ex)
		}
	})
	// Review Focus 2: a transient failure falls through to the next target without a wait.
	t.Run("transient falls through", func(t *testing.T) {
		t.Parallel()
		a := llmtest.New("a", llmtest.Step{Model: "m1", Err: transient}, llmtest.Step{Model: "m2", Response: text("ok")})
		b := llmtest.New("b")
		f := newFixture(a, b)
		resp, err := f.router.Client(target("a/m1"), target("a/m2"), target("b/m1")).Generate(context.Background(), prompt())
		if err != nil || resp.Target != target("a/m2") || len(b.Requests()) != 0 {
			t.Fatalf("resp = %+v, err = %v, third target calls = %d", resp.Target, err, len(b.Requests()))
		}
	})
}
