package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (r *Repository) InsertCreditLimit(ctx context.Context, booksID int64, l app.CreditLimit) (app.CreditLimit, error) {
	_, err := r.q.InsertCreditLimit(ctx, InsertCreditLimitParams{BooksID: booksID, AccountID: l.AccountID, EffectiveFrom: l.EffectiveFrom, Amount: l.Amount.Amount()})
	if err != nil {
		return app.CreditLimit{}, err
	}

	return l, nil
}

func (r *Repository) CreditLimits(ctx context.Context, booksID int64, accountID uuid.UUID) ([]app.CreditLimit, error) {
	rows, err := r.q.ListCreditLimits(ctx, ListCreditLimitsParams{BooksID: booksID, AccountID: accountID})
	if err != nil {
		return nil, err
	}

	a, err := r.Account(ctx, booksID, accountID)
	if err != nil {
		return nil, err
	}

	out := make([]app.CreditLimit, len(rows))
	for i, row := range rows {
		amount, err := money.New(row.Amount, a.Instrument)
		if err != nil {
			return nil, err
		}

		out[i] = app.CreditLimit{AccountID: row.AccountID, EffectiveFrom: row.EffectiveFrom, Amount: amount}
	}

	return out, nil
}
