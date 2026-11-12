package assistant

import (
	"context"

	"github.com/andrelopes-code/equori/internal/assistant/app"
	"github.com/andrelopes-code/equori/internal/assistant/llmapi"
	"github.com/andrelopes-code/equori/internal/assistant/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Tools returns the assistant's own tools for language models (ADR 012).
func (m *Module) Tools() tool.Group { return tool.Group{Tools: toolapi.Tools(m.screens)} }

// UseTools sets the chat's tools; it fails when a tool that writes has no preview (spec 8.1).
func (m *Module) UseTools(set tool.Set) error {
	tools, err := llmapi.NewChatSet(set)
	if err != nil {
		return err
	}

	m.svc.UseTools(tools)
	m.chat = set
	m.bindAgent(tools)

	return nil
}

// UseNotices sets the lookup of the accounts the system prompt names (P12 A152).
func (m *Module) UseNotices(n func(context.Context, int64) ([]AccountNotice, error)) {
	m.svc.UseNotices(n)
}

// UseSignals sets the lookup of the signals of a preview; nil attaches none.
func (m *Module) UseSignals(
	f func(ctx context.Context, booksID int64, p tool.Preview) ([]Signal, error),
) {
	m.svc.UseSignals(f)
}

// UseRouter sets the router the chat calls models through.
func (m *Module) UseRouter(r *llm.Router) {
	m.router = r
	m.bindAgent(nil)
}

func (m *Module) bindAgent(tools app.Tools) {
	if tools != nil {
		m.tools = tools
	}

	if m.tools == nil || m.router == nil {
		return
	}

	m.svc.UseAgent(llmapi.NewAgent(m.router.Use(ChatUse), m.svc, m.tools, m.chat, m.wait), m.locale)
}
