package postgres

import (
	"context"

	"github.com/google/uuid"
)

func (r *Repository) MergeCategory(ctx context.Context, booksID int64, from, into uuid.UUID) error {
	if err := r.q.DeleteMergedBudget(ctx, DeleteMergedBudgetParams{BooksID: booksID, FromID: from, IntoID: into}); err != nil {
		return err
	}

	if err := r.q.MoveMergedBudget(ctx, MoveMergedBudgetParams{BooksID: booksID, FromID: from, IntoID: into}); err != nil {
		return err
	}

	return r.q.MergeScheduleAccounts(ctx, MergeScheduleAccountsParams{BooksID: booksID, FromID: from, IntoID: into})
}

func (r *Repository) MergePayee(ctx context.Context, booksID int64, from, into uuid.UUID) error {
	return r.q.MergeSchedulePayee(ctx, MergeSchedulePayeeParams{BooksID: booksID, FromID: uuid.NullUUID{UUID: from, Valid: true}, IntoID: uuid.NullUUID{UUID: into, Valid: true}})
}
