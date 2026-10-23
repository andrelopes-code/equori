package llmapi

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

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
}

var _ app.Agent = (*Agent)(nil)

// NewAgent declares every tool of set on every step, sorted by name (spec 7.3, delivery A).
func NewAgent(client *llm.Client, svc *app.Service, tools app.Tools, set tool.Set) *Agent {
	decls, handlers := ChatHandlers(svc, tools, set, app.TurnConversation)
	slices.SortFunc(decls, func(a, b llm.Tool) int { return strings.Compare(a.Name, b.Name) })
	return &Agent{client: client, decls: decls, handlers: handlers}
}

func (a *Agent) Run(ctx context.Context, userID int64, in app.AgentRequest, onStep func(string), onRestart func()) (app.AgentResult, error) {
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
	})
	out := app.AgentResult{
		Text: res.Response.Text(), StepLimit: res.StepLimit, Restarted: res.Restarted, Steps: res.Steps, ToolCalls: calls,
		InputTokens: res.Usage.InputTokens, OutputTokens: res.Usage.OutputTokens,
		ProviderName: res.Response.Target.Provider, Model: res.Response.Target.Model,
	}
	return out, mapError(err)
}

// mapError turns the model loop's failures into the errors of spec 6.2.
func mapError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return err
	case errors.Is(err, llm.ErrExhausted):
		if ee, ok := errors.AsType[*llm.ExhaustedError](err); ok {
			return &app.LimitError{RetryAt: ee.RetryAt}
		}
		return fmt.Errorf("%w: %w", app.ErrTurnFailed, err)
	case errors.Is(err, llm.ErrUnavailable):
		return app.ErrChatUnavailable
	}
	return fmt.Errorf("%w: %w", app.ErrTurnFailed, err)
}
