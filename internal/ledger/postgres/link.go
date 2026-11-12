package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

func (r *Repository) LinksTo(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) ([]app.Reference, error) {
	rows, err := r.q.ListLinksTo(ctx, ListLinksToParams{BooksID: booksID, ToTransactionID: id})
	if err != nil {
		return nil, err
	}

	out := make([]app.Reference, len(rows))
	for i, row := range rows {
		out[i] = app.Reference{
			Type:     domain.LinkType(row.LinkType),
			Source:   row.FromTransactionID,
			Amount:   storedAmount(row.Amount),
			Currency: row.BalancingCurrency,
		}
	}

	return out, nil
}

// linkAmount stores no amount for a link that holds none.
func linkAmount(amount int64) *int64 {
	if amount == 0 {
		return nil
	}

	return &amount
}

func storedAmount(v *int64) int64 {
	if v == nil {
		return 0
	}

	return *v
}
