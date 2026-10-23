package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

func toConversation(row AssistantConversation) domain.Conversation {
	return domain.Conversation{ID: row.ID, Title: row.Title, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt}
}

func toMessage(row AssistantMessage) domain.Message {
	m := domain.Message{
		ID: row.ID, ConversationID: row.ConversationID, Seq: int(row.Seq), Role: domain.Role(row.Role),
		Content: row.Content, CreatedAt: row.CreatedAt,
	}
	if row.Outcome != nil {
		m.Outcome = domain.Outcome(*row.Outcome)
	}
	return m
}

func (r *Repository) CreateConversation(ctx context.Context, userID int64, c domain.Conversation) error {
	return r.q.InsertConversation(ctx, InsertConversationParams{
		ID: c.ID, UserID: userID, Title: c.Title, CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt,
	})
}

func (r *Repository) Conversation(ctx context.Context, userID int64, id uuid.UUID) (domain.Conversation, error) {
	row, err := r.q.ConversationByID(ctx, ConversationByIDParams{UserID: userID, ID: id})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Conversation{}, domain.ErrConversationNotFound
	}
	return toConversation(row), err
}

func (r *Repository) Conversations(ctx context.Context, userID int64, after *app.ConversationKey, limit int) ([]domain.Conversation, error) {
	arg := ListConversationsParams{UserID: userID, RowLimit: int32(limit)} //nolint:gosec // the caller bounds limit
	if after != nil {
		arg.AfterUpdatedAt = &after.UpdatedAt
		arg.AfterID = uuid.NullUUID{UUID: after.ID, Valid: true}
	}
	rows, err := r.q.ListConversations(ctx, arg)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Conversation, len(rows))
	for i, row := range rows {
		out[i] = toConversation(row)
	}
	return out, nil
}

func (r *Repository) DeleteConversation(ctx context.Context, userID int64, id uuid.UUID) error {
	n, err := r.q.DeleteConversation(ctx, DeleteConversationParams{UserID: userID, ID: id})
	if err == nil && n == 0 {
		return domain.ErrConversationNotFound
	}
	return err
}

func (r *Repository) DeleteConversations(ctx context.Context, userID int64) error {
	return r.q.DeleteConversations(ctx, userID)
}

func (r *Repository) AppendMessage(ctx context.Context, userID int64, m domain.Message) (domain.Message, error) {
	var outcome *string
	if m.Outcome != domain.OutcomeNone {
		o := string(m.Outcome)
		outcome = &o
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Message{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := r.q.WithTx(tx)
	row, err := q.AppendMessage(ctx, AppendMessageParams{
		ID: m.ID, UserID: userID, ConversationID: m.ConversationID, Role: string(m.Role), Content: m.Content,
		Outcome: outcome, CreatedAt: m.CreatedAt,
	})
	if err != nil {
		return domain.Message{}, err
	}
	if err := q.TouchConversation(ctx, TouchConversationParams{UpdatedAt: m.CreatedAt, UserID: userID, ID: m.ConversationID}); err != nil {
		return domain.Message{}, err
	}
	return toMessage(row), tx.Commit(ctx)
}

func (r *Repository) Messages(ctx context.Context, userID int64, conversationID uuid.UUID) ([]domain.Message, error) {
	rows, err := r.q.ListMessages(ctx, ListMessagesParams{UserID: userID, ConversationID: conversationID})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Message, len(rows))
	for i, row := range rows {
		out[i] = toMessage(row)
	}
	return out, nil
}

func utc(t *time.Time) *time.Time {
	if t == nil || t.IsZero() {
		return nil
	}
	return t
}
