package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// OpeningLosses lists the opening losses of the book by pool.
func (r *Repository) OpeningLosses(
	ctx context.Context,
	booksID int64,
) ([]domain.OpeningLoss, error) {
	rows, err := r.q.OpeningLosses(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("list opening losses: %w", err)
	}

	out := make([]domain.OpeningLoss, len(rows))
	for i, row := range rows {
		out[i] = domain.OpeningLoss{Pool: row.Pool, Month: row.Month, Amount: row.Amount}
	}

	return out, nil
}

// ReplaceOpeningLosses deletes the opening losses of the book and inserts losses; on a pool it
// runs in one transaction.
func (r *Repository) ReplaceOpeningLosses(
	ctx context.Context,
	booksID int64,
	losses []domain.OpeningLoss,
) error {
	if r.pool == nil {
		return replaceOpeningLosses(ctx, r.q, booksID, losses)
	}

	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		return replaceOpeningLosses(ctx, New(tx), booksID, losses)
	})
}

func replaceOpeningLosses(
	ctx context.Context,
	q *Queries,
	booksID int64,
	losses []domain.OpeningLoss,
) error {
	if err := q.DeleteOpeningLosses(ctx, booksID); err != nil {
		return fmt.Errorf("delete opening losses: %w", err)
	}

	for _, l := range losses {
		err := q.InsertOpeningLoss(ctx, InsertOpeningLossParams{
			BooksID: booksID,
			Pool:    l.Pool,
			Month:   l.Month,
			Amount:  l.Amount,
		})
		if err != nil {
			return fmt.Errorf("insert opening loss of %q: %w", l.Pool, err)
		}
	}

	return nil
}
