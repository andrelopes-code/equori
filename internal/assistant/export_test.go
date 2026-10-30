package assistant

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
)

// ProposeForTest stores a proposal as the chat handler of a write tool does.
func ProposeForTest(m *Module, ctx context.Context, booksID int64, conversationID uuid.UUID, name string, args json.RawMessage) (json.RawMessage, error) {
	return m.svc.Propose(ctx, booksID, conversationID, name, args)
}
