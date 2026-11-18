package assistant

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/app"
	"github.com/andrelopes-code/equori/internal/assistant/domain"
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

// UseFileSummary sets what describes an ofx or csv file to the model (assistant parity design, F4).
func (m *Module) UseFileSummary(summarize func(kind string, content []byte) string) {
	m.svc.UseFileSummary(summarize)
}

// ConversationFile returns the name, the kind and the content of a file the member attached to a
// conversation; found is false when the member has no such file (assistant parity design, F7).
func (m *Module) ConversationFile(
	ctx context.Context,
	booksID, memberID int64,
	id uuid.UUID,
) (name, kind string, content []byte, found bool, err error) {
	n, k, c, err := m.svc.FileContent(ctx, booksID, memberID, id)
	if errors.Is(err, domain.ErrFileNotFound) {
		return "", "", nil, false, nil
	}

	if err != nil {
		return "", "", nil, false, err
	}

	return n, string(k), c, true, nil
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
