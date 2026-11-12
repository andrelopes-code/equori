package postgres

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (r *Repository) Settings(ctx context.Context, booksID int64) (app.Settings, error) {
	row, err := r.q.GetSettings(ctx, booksID)
	if err != nil {
		return app.Settings{}, notFound(err)
	}

	return app.Settings{BooksID: row.BooksID, BaseCurrency: money.Currency(row.BaseCurrency)}, nil
}

func (r *Repository) SaveSettings(ctx context.Context, s app.Settings) error {
	return r.q.UpsertSettings(
		ctx,
		UpsertSettingsParams{BooksID: s.BooksID, BaseCurrency: string(s.BaseCurrency)},
	)
}

func (r *Repository) SetSystemAccountsInstrument(
	ctx context.Context,
	booksID int64,
	c money.Currency,
) error {
	return r.q.SetSystemAccountsInstrument(
		ctx,
		SetSystemAccountsInstrumentParams{BooksID: booksID, Instrument: string(c)},
	)
}
