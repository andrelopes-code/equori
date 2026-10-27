package llmapi

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

// Design 2026-10-26 E6, E7: a turn blocked only by transient cooldowns waits once inside its deadline.
func TestAgentWaitsOnceForTransient(t *testing.T) {
	t.Parallel()
	start := time.Date(2026, 10, 23, 10, 0, 0, 0, time.UTC)
	transient := llmtest.Step{Model: "m", Err: fmt.Errorf("500: %w", llm.ErrTransient)}
	ok := llmtest.Step{Model: "m", Response: llm.Response{
		Message: llm.Message{Role: llm.RoleModel, Parts: []llm.Part{{Text: "ok"}}}, FinishReason: llm.FinishStop,
	}}
	tests := []struct {
		name      string
		steps     []llmtest.Step
		deadline  time.Duration
		wantText  string
		wantLimit time.Time
		wantWaits []time.Time
	}{
		{name: "transient then answer", steps: []llmtest.Step{transient, ok}, deadline: 90 * time.Second, wantText: "ok", wantWaits: []time.Time{start.Add(10 * time.Second)}},
		{name: "transient twice", steps: []llmtest.Step{transient, transient}, deadline: 90 * time.Second, wantWaits: []time.Time{start.Add(10 * time.Second)}},
		{name: "cooldown past the deadline", steps: []llmtest.Step{transient}, deadline: 5 * time.Second},
		{name: "quota", steps: []llmtest.Step{{Model: "m", Err: &llm.QuotaError{RetryAfter: time.Hour}}}, deadline: 90 * time.Second, wantLimit: start.Add(time.Hour)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			now := start
			clk := clock.New(time.UTC, func() time.Time { return now })
			router := llm.NewRouter(&clk, slog.New(slog.NewTextHandler(io.Discard, nil)), nil, llmtest.New("p", tt.steps...))
			var waits []time.Time
			a := &Agent{client: router.Client(llm.Target{Provider: "p", Model: "m"}), handlers: map[string]llm.ToolHandler{},
				wait: func(_ context.Context, until time.Time) error {
					waits = append(waits, until)
					now = until
					return nil
				}}
			res, err := a.Run(t.Context(), 1, app.AgentRequest{Text: "oi", Deadline: start.Add(tt.deadline)}, func(string) {}, func() {})
			switch {
			case tt.wantText != "":
				if err != nil || res.Text != tt.wantText {
					t.Fatalf("Run = %q, %v; want %q", res.Text, err, tt.wantText)
				}
			case !tt.wantLimit.IsZero():
				if le, ok := errors.AsType[*app.LimitError](err); !ok || !le.RetryAt.Equal(tt.wantLimit) {
					t.Fatalf("err = %v, want LimitError at %v", err, tt.wantLimit)
				}
			default:
				if _, ok := errors.AsType[*app.LimitError](err); ok || !errors.Is(err, app.ErrTurnFailed) {
					t.Fatalf("err = %v, want ErrTurnFailed", err)
				}
			}
			if len(waits) != len(tt.wantWaits) || (len(waits) == 1 && !waits[0].Equal(tt.wantWaits[0])) {
				t.Fatalf("waits = %v, want %v", waits, tt.wantWaits)
			}
		})
	}
}
