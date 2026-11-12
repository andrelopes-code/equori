package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (r *Repository) BalanceAt(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	basis app.Basis,
) (int64, error) {
	if basis == app.BasisSettled {
		return r.q.BalanceSettledAt(
			ctx,
			BalanceSettledAtParams{BooksID: booksID, AccountID: accountID, OnDate: &date},
		)
	}

	return r.q.BalanceBookedAt(
		ctx,
		BalanceBookedAtParams{BooksID: booksID, AccountID: accountID, OnDate: date},
	)
}

func (r *Repository) BalancesAt(
	ctx context.Context,
	booksID int64,
	date time.Time,
	basis app.Basis,
) ([]app.AccountTotal, error) {
	if basis == app.BasisSettled {
		rows, err := r.q.AccountBalancesSettledAt(
			ctx,
			AccountBalancesSettledAtParams{BooksID: booksID, OnDate: &date},
		)

		return mapAll(rows, func(row AccountBalancesSettledAtRow) app.AccountTotal {
			return app.AccountTotal{
				AccountID:  row.ID,
				Instrument: money.Currency(row.Instrument),
				Total:      row.Total,
			}
		}), err
	}

	rows, err := r.q.AccountBalancesBookedAt(
		ctx,
		AccountBalancesBookedAtParams{BooksID: booksID, OnDate: date},
	)

	return mapAll(rows, func(row AccountBalancesBookedAtRow) app.AccountTotal {
		return app.AccountTotal{
			AccountID:  row.ID,
			Instrument: money.Currency(row.Instrument),
			Total:      row.Total,
		}
	}), err
}

func (r *Repository) CategoryTotal(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from, to time.Time,
) (int64, error) {
	return r.q.CategoryTotal(
		ctx,
		CategoryTotalParams{BooksID: booksID, AccountID: accountID, FromDate: from, ToDate: to},
	)
}

func (r *Repository) CategoryMonthlyTotals(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from, to time.Time,
) (map[time.Time]int64, error) {
	rows, err := r.q.CategoryMonthlyTotals(
		ctx,
		CategoryMonthlyTotalsParams{
			BooksID:   booksID,
			AccountID: accountID,
			FromDate:  from,
			ToDate:    to,
		},
	)
	if err != nil {
		return nil, err
	}

	out := make(map[time.Time]int64, len(rows))
	for _, row := range rows {
		out[row.Month] = row.Total
	}

	return out, nil
}

func (r *Repository) OwnCategoryMonthlyTotals(
	ctx context.Context,
	booksID int64,
	class string,
	from, to time.Time,
) ([]app.CategoryMonth, error) {
	rows, err := r.q.OwnCategoryMonthlyTotals(
		ctx,
		OwnCategoryMonthlyTotalsParams{
			BooksID:      booksID,
			AccountClass: class,
			FromDate:     from,
			ToDate:       to,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("own category monthly totals: %w", err)
	}

	out := make([]app.CategoryMonth, len(rows))
	for i, row := range rows {
		out[i] = app.CategoryMonth{CategoryID: row.AccountID, Month: row.Month, Total: row.Total}
	}

	return out, nil
}
