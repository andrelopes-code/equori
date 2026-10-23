package llmapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type chatSet struct {
	tool.Set
	effects map[string]tool.Effect
}

func (c chatSet) Effect(name string) (tool.Effect, bool) {
	e, ok := c.effects[name]
	return e, ok
}

// NewChatSet refuses a tool that writes and has no preview (spec 8.1).
func NewChatSet(set tool.Set) (app.Tools, error) {
	effects := map[string]tool.Effect{}
	for _, t := range set.Tools() {
		s := t.Spec()
		if s.Effect != tool.ReadOnly && !t.HasPreview() {
			return nil, fmt.Errorf("chat tool %s writes and has no preview", s.Name)
		}
		effects[s.Name] = s.Effect
	}
	return chatSet{Set: set, effects: effects}, nil
}

// ChatHandlers returns the declarations and handlers of the chat: read tools run, write tools
// store a proposal in the conversation that conversationID reads from the context.
func ChatHandlers(svc *app.Service, tools app.Tools, set tool.Set, conversationID func(context.Context) uuid.UUID) ([]llm.Tool, map[string]llm.ToolHandler) {
	decls, handlers := set.LLM()
	for _, d := range decls {
		name := d.Name
		if e, _ := tools.Effect(name); e == tool.ReadOnly {
			continue
		}
		handlers[name] = func(ctx context.Context, args json.RawMessage) (json.RawMessage, error) {
			out, err := svc.Propose(ctx, auth.MustUserID(ctx), conversationID(ctx), name, args)
			if tf, ok := errors.AsType[*app.ToolFailure](err); ok {
				return nil, &llm.ToolError{Content: tf.Content}
			}
			return out, err
		}
	}
	return decls, handlers
}
