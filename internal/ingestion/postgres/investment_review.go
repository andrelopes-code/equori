package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

// InvestmentOfMovement returns the investment that holds the movement, with all its movements.
func (r *Repository) InvestmentOfMovement(
	ctx context.Context,
	booksID int64,
	movementID uuid.UUID,
) (domain.StoredInvestment, error) {
	row, err := r.q.InvestmentMovement(
		ctx,
		InvestmentMovementParams{BooksID: booksID, ID: movementID},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.StoredInvestment{}, app.ErrNotFound
	}

	if err != nil {
		return domain.StoredInvestment{}, fmt.Errorf("read investment movement: %w", err)
	}

	inv := toStoredInvestment(row)

	moves, err := r.q.ListInvestmentMovements(
		ctx,
		ListInvestmentMovementsParams{BooksID: booksID, InvestmentIds: []uuid.UUID{inv.ID}},
	)
	if err != nil {
		return domain.StoredInvestment{}, fmt.Errorf("list investment movements: %w", err)
	}

	for _, m := range moves {
		inv.Movements = append(inv.Movements, toStoredMovement(m, inv.Source.Balance))
	}

	return inv, nil
}

// ResolveMovements writes the changes and the link in one database transaction.
func (r *Repository) ResolveMovements(
	ctx context.Context,
	booksID int64,
	changes []app.MovementChange,
	link *app.InvestmentLink,
) error {
	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		for _, c := range changes {
			if err := q.SetInvestmentMovementState(ctx, SetInvestmentMovementStateParams{
				BooksID:       booksID,
				ID:            c.ID,
				State:         c.State,
				TransactionID: nullUUID(c.TransactionID),
				ApplicationID: c.ApplicationID,
			}); err != nil {
				return fmt.Errorf("set movement state: %w", err)
			}
		}

		if link == nil {
			return nil
		}

		if err := q.LinkExternalInvestment(ctx, LinkExternalInvestmentParams{
			BooksID:     booksID,
			ID:          link.InvestmentID,
			BrokerageID: nullUUID(link.BrokerageID),
			AccountID:   nullUUID(link.AccountID),
			Instrument:  link.Instrument,
		}); err != nil {
			return fmt.Errorf("link investment: %w", err)
		}

		return nil
	})
}

func nullUUID(id *uuid.UUID) uuid.NullUUID {
	if id == nil {
		return uuid.NullUUID{}
	}

	return uuid.NullUUID{UUID: *id, Valid: true}
}
