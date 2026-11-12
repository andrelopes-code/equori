package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
)

func (r *Repository) SecurityPostings(
	ctx context.Context,
	booksID int64,
	accountIDs []uuid.UUID,
) ([]app.HoldingPosting, error) {
	rows, err := r.q.SecurityPostings(
		ctx,
		SecurityPostingsParams{BooksID: booksID, AccountIds: accountIDs},
	)

	return mapAll(rows, func(row SecurityPostingsRow) app.HoldingPosting {
		return app.HoldingPosting{
			AccountID:     row.AccountID,
			TransactionID: row.TransactionID,
			Date:          row.BookedOn,
			Quantity:      row.Amount,
			Weight:        row.Weight,
		}
	}), err
}

func (r *Repository) SecurityTrades(
	ctx context.Context,
	booksID int64,
	accountIDs []uuid.UUID,
) ([]app.TradeFact, error) {
	rows, err := r.q.SecurityTrades(
		ctx,
		SecurityTradesParams{BooksID: booksID, AccountIds: accountIDs},
	)

	return mapAll(rows, func(row SecurityTradesRow) app.TradeFact {
		f := app.TradeFact{
			TransactionID: row.TransactionID,
			AccountID:     row.AccountID,
			Date:          row.Date,
			Side:          row.Side,
			Quantity:      row.Quantity,
			Gross:         row.Gross,
			Fees:          row.Fees,
			Taxes:         row.Taxes,
		}
		if row.Cost != nil {
			f.Cost = *row.Cost
		}

		return f
	}), err
}

func (r *Repository) SecurityIncomes(
	ctx context.Context,
	booksID int64,
	accountIDs []uuid.UUID,
) ([]app.IncomeFact, error) {
	rows, err := r.q.SecurityIncomes(
		ctx,
		SecurityIncomesParams{BooksID: booksID, AccountIds: accountIDs},
	)

	return mapAll(rows, func(row SecurityIncomesRow) app.IncomeFact {
		return app.IncomeFact{
			TransactionID: row.TransactionID,
			AccountID:     row.AccountID,
			Date:          row.Date,
			Type:          row.IncomeType,
			Gross:         row.Gross,
			Withheld:      row.Withheld,
		}
	}), err
}

func (r *Repository) Holding(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
) (int64, int64, error) {
	row, err := r.q.Holding(
		ctx,
		HoldingParams{BooksID: booksID, AccountID: accountID, OnDate: date},
	)
	return row.Quantity, row.CostBasis, err
}

func (r *Repository) LaterSaleExists(
	ctx context.Context,
	booksID int64,
	accountIDs []uuid.UUID,
	date time.Time,
	exclude uuid.UUID,
) (bool, error) {
	return r.q.LaterSaleExists(
		ctx,
		LaterSaleExistsParams{
			BooksID:    booksID,
			AccountIds: accountIDs,
			OnDate:     date,
			Exclude:    exclude,
		},
	)
}
