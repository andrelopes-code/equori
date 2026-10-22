// Package postgres keeps the capture's category hints (ADR 014).
package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/capture/internal/app"
)

type Repository struct{ q *Queries }

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{q: New(pool)} }

func (r *Repository) Hints(ctx context.Context, userID int64, descriptions []string) ([]app.Hint, error) {
	rows, err := r.q.CategoryHints(ctx, CategoryHintsParams{UserID: userID, Descriptions: descriptions})
	if err != nil {
		return nil, err
	}
	out := make([]app.Hint, len(rows))
	for i, row := range rows {
		out[i] = app.Hint{Class: row.Class, Description: row.Description, CategoryID: row.CategoryID.UUID, AnsweredAt: row.AnsweredAt}
	}
	return out, nil
}

func (r *Repository) SaveHint(ctx context.Context, userID int64, h app.Hint) error {
	return r.q.SaveCategoryHint(ctx, SaveCategoryHintParams{
		UserID: userID, Class: h.Class, Description: h.Description,
		CategoryID: uuid.NullUUID{UUID: h.CategoryID, Valid: h.CategoryID != uuid.Nil}, AnsweredAt: h.AnsweredAt,
	})
}
