package app

import (
	"context"
	"sync"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
)

type turnKey struct{}

// turnState collects the proposals, reads and views of a turn and names its conversation for the handlers.
type turnState struct {
	conversationID uuid.UUID
	mu             sync.Mutex
	proposals      []uuid.UUID
	reads          []turnRead
	views          []domain.View
}

func (t *turnState) add(id uuid.UUID) {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.proposals = append(t.proposals, id)
}

func (t *turnState) take() []uuid.UUID {
	t.mu.Lock()
	defer t.mu.Unlock()

	ids := t.proposals
	t.proposals = nil

	return ids
}

// TurnConversation returns the conversation of the turn that owns ctx.
func TurnConversation(ctx context.Context) uuid.UUID {
	if t, ok := ctx.Value(turnKey{}).(*turnState); ok {
		return t.conversationID
	}

	return uuid.Nil
}
