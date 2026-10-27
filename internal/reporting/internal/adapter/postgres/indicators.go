package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

func (r *Repository) BaseCurrency(ctx context.Context, userID int64) (string, error) {
	return r.q.IndicatorBaseCurrency(ctx, userID)
}

func (r *Repository) FirstPosting(ctx context.Context, userID int64) (time.Time, bool, error) {
	first, err := r.q.IndicatorFirstPosting(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, false, nil
	}
	if err != nil {
		return time.Time{}, false, err
	}
	return first, true, nil
}

func (r *Repository) IndicatorAccounts(ctx context.Context, userID int64) ([]app.IndicatorAccount, error) {
	rows, err := r.q.IndicatorAccounts(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]app.IndicatorAccount, len(rows))
	for i, row := range rows {
		out[i] = app.IndicatorAccount{
			ID: row.ID, Class: row.AccountClass, Kind: row.Kind, Instrument: row.Instrument,
			Interest: row.Interest, ExcludedFromLiquidity: row.ExcludedFromLiquidity,
		}
	}
	return out, nil
}

func (r *Repository) LoanPrincipalByMonth(ctx context.Context, userID int64, from, to time.Time) (map[time.Time]int64, error) {
	rows, err := r.q.LoanPrincipalByMonth(ctx, LoanPrincipalByMonthParams{UserID: userID, FromDate: from, ToDate: to})
	if err != nil {
		return nil, err
	}
	out := make(map[time.Time]int64, len(rows))
	for _, row := range rows {
		out[row.Month] = row.Total
	}
	return out, nil
}
