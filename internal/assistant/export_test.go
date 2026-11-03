package assistant

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/llmapi"
	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/llm"
)

// ProposeForTest stores a proposal as the chat handler of a write tool does.
func ProposeForTest(m *Module, ctx context.Context, booksID int64, conversationID uuid.UUID, name string, args json.RawMessage, meta app.ProposalMeta) (json.RawMessage, error) {
	return m.svc.Propose(ctx, booksID, conversationID, name, args, meta)
}

// ChatHandlersForTest returns the declarations and handlers the chat sends to the model.
func ChatHandlersForTest(m *Module, conversationID func(context.Context) uuid.UUID) ([]llm.Tool, map[string]llm.ToolHandler) {
	return llmapi.ChatHandlers(m.svc, m.tools, m.chat, conversationID)
}
