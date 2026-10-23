package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

// ConversationPage returns up to limit conversations after the given position, most recently updated first,
// and the position of the next page when there is one.
func (s *Service) ConversationPage(ctx context.Context, userID int64, after *ConversationKey, limit int) ([]domain.Conversation, *ConversationKey, error) {
	rows, err := s.repo.Conversations(ctx, userID, after, limit+1)
	if err != nil {
		return nil, nil, err
	}
	if len(rows) <= limit {
		return rows, nil, nil
	}
	rows = rows[:limit]
	last := rows[limit-1]
	return rows, &ConversationKey{UpdatedAt: last.UpdatedAt, ID: last.ID}, nil
}

// ConversationDetail is a conversation with its messages and the proposals of each answer.
type ConversationDetail struct {
	Conversation domain.Conversation
	Messages     []domain.Message
	Proposals    []domain.Proposal
}

func (s *Service) Conversation(ctx context.Context, userID int64, id uuid.UUID) (ConversationDetail, error) {
	c, err := s.repo.Conversation(ctx, userID, id)
	if err != nil {
		return ConversationDetail{}, err
	}
	msgs, err := s.repo.Messages(ctx, userID, id)
	if err != nil {
		return ConversationDetail{}, err
	}
	ps, err := s.repo.Proposals(ctx, userID, id)
	if err != nil {
		return ConversationDetail{}, err
	}
	return ConversationDetail{Conversation: c, Messages: msgs, Proposals: ps}, nil
}

func (s *Service) DeleteConversation(ctx context.Context, userID int64, id uuid.UUID) error {
	return s.repo.DeleteConversation(ctx, userID, id)
}

func (s *Service) DeleteConversations(ctx context.Context, userID int64) error {
	return s.repo.DeleteConversations(ctx, userID)
}
