package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
)

// InsertViews stores the views of an answer, in the order of their seq (answer views design, V9).
func (r *Repository) InsertViews(
	ctx context.Context,
	booksID int64,
	conversationID, messageID uuid.UUID,
	views []domain.View,
) error {
	for _, v := range views {
		err := r.q.InsertView(ctx, InsertViewParams{
			ID:             v.ID,
			BooksID:        booksID,
			ConversationID: conversationID,
			MessageID:      messageID,
			Seq:            int32(v.Seq),
			Form:           v.Form,
			Payload:        v.Payload,
			CreatedAt:      v.CreatedAt,
		})
		if err != nil {
			return err
		}
	}

	return nil
}

// Views returns the views of a conversation, each with its message, in the order they were built.
func (r *Repository) Views(
	ctx context.Context,
	booksID int64,
	conversationID uuid.UUID,
) ([]domain.View, error) {
	rows, err := r.q.ConversationViews(ctx, ConversationViewsParams{
		BooksID:        booksID,
		ConversationID: conversationID,
	})
	if err != nil {
		return nil, err
	}

	views := make([]domain.View, len(rows))
	for i, row := range rows {
		views[i] = domain.View{
			ID:        row.ID,
			MessageID: row.MessageID,
			Seq:       int(row.Seq),
			Form:      row.Form,
			Payload:   row.Payload,
			CreatedAt: row.CreatedAt,
		}
	}

	return views, nil
}
