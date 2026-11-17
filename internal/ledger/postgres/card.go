package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

func (r *Repository) InsertCard(ctx context.Context, c domain.Card) (domain.Card, error) {
	//nolint:gosec // G115: NewCard bounds the rate to 0–10000
	row, err := r.q.InsertCard(
		ctx,
		InsertCardParams{
			BooksID:         c.BooksID,
			AccountID:       c.AccountID,
			Holder:          c.Holder,
			LastFour:        c.LastFour,
			Virtual:         c.Virtual,
			ForeignChargeBp: int32(c.ForeignChargeBP),
			Network:         nullString(c.Network),
		},
	)
	if err != nil {
		return domain.Card{}, referenceError(err)
	}

	return toCard(row), nil
}

func (r *Repository) UpdateCard(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	e domain.CardEdit,
) (domain.Card, error) {
	row, err := r.q.UpdateCard(
		ctx,
		UpdateCardParams{
			BooksID:  booksID,
			ID:       id,
			Holder:   e.Holder,
			LastFour: e.LastFour,
			Active:   e.Active,
			Network:  e.Network,
		},
	)
	if err != nil {
		return domain.Card{}, notFound(err)
	}

	return toCard(row), nil
}

func (r *Repository) DeleteCard(ctx context.Context, booksID int64, id uuid.UUID) error {
	n, err := r.q.DeleteCard(ctx, DeleteCardParams{BooksID: booksID, ID: id})
	if err != nil {
		return err
	}

	if n == 0 {
		return app.ErrNotFound
	}

	return nil
}

func (r *Repository) Cards(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) ([]domain.Card, error) {
	rows, err := r.q.ListCards(ctx, ListCardsParams{BooksID: booksID, AccountID: accountID})
	return mapAll(rows, toCard), err
}
