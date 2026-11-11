package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (r *Repository) TreeInstruments(ctx context.Context, booksID int64, accountID uuid.UUID) ([]money.Currency, error) {
	rows, err := r.q.TreeInstruments(ctx, TreeInstrumentsParams{BooksID: booksID, AccountID: accountID})

	out := make([]money.Currency, len(rows))
	for i, c := range rows {
		out[i] = money.Currency(c)
	}

	return out, err
}

func (r *Repository) TreeBalancesByInstrument(ctx context.Context, booksID int64, accountID uuid.UUID, date time.Time, basis app.Basis) (map[money.Currency]int64, error) {
	rows, err := r.q.TreeBalancesByInstrument(ctx, TreeBalancesByInstrumentParams{BooksID: booksID, AccountID: accountID, Settled: basis == app.BasisSettled, OnDate: &date})

	out := make(map[money.Currency]int64, len(rows))
	for _, row := range rows {
		out[money.Currency(row.Instrument)] = row.Total
	}

	return out, err
}

func (r *Repository) TreeExternalFlows(ctx context.Context, booksID int64, accountIDs []uuid.UUID, from, to time.Time) ([]app.ExternalFlow, error) {
	rows, err := r.q.TreeExternalFlows(ctx, TreeExternalFlowsParams{BooksID: booksID, AccountIds: accountIDs, FromDate: from, ToDate: to})
	if err != nil {
		return nil, fmt.Errorf("tree external flows: %w", err)
	}

	out := make([]app.ExternalFlow, len(rows))
	for i, row := range rows {
		value, err := money.New(row.Flow, money.Currency(row.BalancingCurrency))
		if err != nil {
			return nil, fmt.Errorf("external flow of %s: %w", row.Date.Format(time.DateOnly), err)
		}

		out[i] = app.ExternalFlow{Date: row.Date, Value: value}
	}

	return out, nil
}

func (r *Repository) TreeFirstPosting(ctx context.Context, booksID int64, accountIDs []uuid.UUID) (time.Time, bool, error) {
	row, err := r.q.TreeFirstPosting(ctx, TreeFirstPostingParams{BooksID: booksID, AccountIds: accountIDs})
	if err != nil {
		return time.Time{}, false, fmt.Errorf("tree first posting: %w", err)
	}

	return row.FirstOn, row.Found, nil
}

func (r *Repository) TreeRecordedYield(ctx context.Context, booksID int64, accountIDs []uuid.UUID, from, to time.Time) (app.RecordedYield, error) {
	rows, err := r.q.TreeRecordedYield(ctx, TreeRecordedYieldParams{BooksID: booksID, AccountIds: accountIDs, FromDate: from, ToDate: to})
	if err != nil {
		return app.RecordedYield{}, fmt.Errorf("tree recorded yield: %w", err)
	}

	var out app.RecordedYield

	for _, row := range rows {
		value, err := money.New(row.Amount, money.Currency(row.Currency))
		if err != nil {
			return app.RecordedYield{}, fmt.Errorf("recorded yield of %s: %w", row.Date.Format(time.DateOnly), err)
		}

		item := app.RecordedItem{Date: row.Date, Value: value, Label: row.Label, Postings: int(row.Postings)}

		switch row.Kind {
		case "flow":
			out.Flows = append(out.Flows, item)
		case "credit":
			out.Credits = append(out.Credits, item)
		case "income":
			out.Income = append(out.Income, item)
		case "expense":
			out.Expense = append(out.Expense, item)
		}
	}

	return out, nil
}
