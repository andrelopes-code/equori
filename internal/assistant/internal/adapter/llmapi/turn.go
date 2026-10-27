package llmapi

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Agent runs the chat's model loop over the tools of the chat set.
type Agent struct {
	client   *llm.Client
	decls    []llm.Tool
	handlers map[string]llm.ToolHandler
	wait     func(ctx context.Context, until time.Time) error
}

var _ app.Agent = (*Agent)(nil)

// NewAgent declares every tool of set on every step, sorted by name (spec 7.3, delivery A). wait blocks until
// the instant a transient cooldown ends (design 2026-10-26 E6).
func NewAgent(client *llm.Client, svc *app.Service, tools app.Tools, set tool.Set, wait func(ctx context.Context, until time.Time) error) *Agent {
	decls, handlers := ChatHandlers(svc, tools, set, app.TurnConversation)
	slices.SortFunc(decls, func(a, b llm.Tool) int { return strings.Compare(a.Name, b.Name) })
	return &Agent{client: client, decls: decls, handlers: handlers, wait: wait}
}

// Run calls the model loop once more after a wait when only transient cooldowns block every target and the
// earliest one ends before the turn's deadline (design 2026-10-26 E6).
func (a *Agent) Run(ctx context.Context, userID int64, in app.AgentRequest, onStep, onText func(string), onRestart func()) (app.AgentResult, error) {
	out, err := a.run(ctx, userID, in, onStep, onText, onRestart)
	ee, ok := errors.AsType[*llm.ExhaustedError](err)
	if !ok || !ee.Transient || !ee.RetryAt.Before(in.Deadline) {
		return out, mapError(err)
	}
	onRestart()
	if err := a.wait(ctx, ee.RetryAt); err != nil {
		return out, mapError(err)
	}
	second, err := a.run(ctx, userID, in, onStep, onText, onRestart)
	second.ToolCalls += out.ToolCalls
	second.InputTokens += out.InputTokens
	second.OutputTokens += out.OutputTokens
	return second, mapError(err)
}

func (a *Agent) run(ctx context.Context, userID int64, in app.AgentRequest, onStep, onText func(string), onRestart func()) (app.AgentResult, error) {
	req := llm.Request{System: in.System, Tools: a.decls}
	for _, m := range in.History {
		role := llm.RoleUser
		if m.Role == domain.RoleAssistant {
			role = llm.RoleModel
		}
		req.Messages = append(req.Messages, llm.Message{Role: role, Parts: []llm.Part{{Text: m.Text}}})
	}
	req.Messages = append(req.Messages, llm.Message{Role: llm.RoleUser, Parts: []llm.Part{{Text: in.Text}}})
	calls := 0
	res, err := llm.Run(auth.WithUserID(ctx, userID), a.client, req, a.handlers, llm.LoopOptions{
		MaxSteps: app.MaxSteps, ForceAnswer: true, Pin: true,
		OnToolCall: func(c llm.ToolCall) {
			calls++
			onStep(c.Name)
		},
		OnRestart: onRestart,
		OnText:    onText,
	})
	out := app.AgentResult{
		Text: res.Response.Text(), StepLimit: res.StepLimit, Restarted: res.Restarted, Steps: res.Steps, ToolCalls: calls,
		InputTokens: res.Usage.InputTokens, OutputTokens: res.Usage.OutputTokens,
		ProviderName: res.Response.Target.Provider, Model: res.Response.Target.Model,
	}
	return out, err
}

// mapError turns the model loop's failures into the errors of spec 6.2.
func mapError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return err
	case errors.Is(err, llm.ErrExhausted):
		if ee, ok := errors.AsType[*llm.ExhaustedError](err); ok && !ee.Transient {
			return &app.LimitError{RetryAt: ee.RetryAt}
		}
		return fmt.Errorf("%w: %w", app.ErrTurnFailed, err)
	case errors.Is(err, llm.ErrUnavailable):
		return app.ErrChatUnavailable
	}
	return fmt.Errorf("%w: %w", app.ErrTurnFailed, err)
}
