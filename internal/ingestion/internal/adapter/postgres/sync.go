package postgres

import (
	"context"
	"encoding/json/v2"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

func nullable(id *uuid.UUID) uuid.NullUUID {
	if id == nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: *id, Valid: true}
}

func (r *Repository) UpdateRecordFacts(ctx context.Context, recs []domain.ExternalRecord) error {
	if len(recs) == 0 {
		return nil
	}
	params := make([]UpdateRecordFactsParams, len(recs))
	for i, rec := range recs {
		raw, err := json.Marshal(rec.Raw)
		if err != nil {
			return err
		}
		f := factsOf(rec)
		params[i] = UpdateRecordFactsParams{
			UserID: rec.UserID, ID: rec.ID, Raw: raw, ExternalStatus: f.status, DueDate: f.dueDate,
			InstallmentNumber: f.number, InstallmentCount: f.count, CategoryID: f.category, BalanceAfter: f.balanceAfter,
			LineKind: f.kind, UnappliedChange: optional(rec.UnappliedChange),
		}
	}
	var first error
	r.q.UpdateRecordFacts(ctx, params).Exec(func(_ int, err error) {
		if err != nil && first == nil {
			first = err
		}
	})
	return first
}

func (r *Repository) SyncedRecords(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]domain.ExternalRecord, error) {
	rows, err := r.q.ListSyncedRecords(ctx, ListSyncedRecordsParams{UserID: userID, AccountID: accountID, FromDate: from, ToDate: to})
	if err != nil {
		return nil, err
	}
	out := make([]domain.ExternalRecord, len(rows))
	for i, row := range rows {
		if out[i], err = toRecord(row); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func (r *Repository) WithdrawRecords(ctx context.Context, userID int64, ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		if err := q.WithdrawReviewCounts(ctx, WithdrawReviewCountsParams{UserID: userID, RecordIds: ids}); err != nil {
			return err
		}
		return q.WithdrawRecords(ctx, WithdrawRecordsParams{UserID: userID, RecordIds: ids})
	})
}

func (r *Repository) MarkAccountSynced(ctx context.Context, a domain.ExternalAccount) error {
	params := MarkAccountSyncedParams{UserID: a.UserID, ID: a.ID, LastSyncedOn: a.LastSyncedOn}
	if a.Balance != nil {
		params.BalanceOn, params.BalanceAmount = &a.Balance.Date, &a.Balance.Amount
	}
	return r.q.MarkAccountSynced(ctx, params)
}

func (r *Repository) SaveConnectionState(ctx context.Context, c domain.Connection) error {
	return r.q.SaveConnectionState(ctx, SaveConnectionStateParams{
		UserID: c.UserID, ID: c.ID, ProviderStatus: c.ProviderStatus, LastItemUpdateAt: c.LastItemUpdateAt,
		NextItemUpdateAt: c.NextItemUpdateAt, LastSyncedAt: c.LastSyncedAt, LastError: optional(c.LastError),
	})
}

func (r *Repository) AllConnections(ctx context.Context) ([]app.ConnectionRef, error) {
	rows, err := r.q.ListAllConnections(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]app.ConnectionRef, len(rows))
	for i, row := range rows {
		out[i] = app.ConnectionRef{UserID: row.UserID, ID: row.ID}
	}
	return out, nil
}

func (r *Repository) InstallmentPlans(ctx context.Context, userID int64, keys [][]byte) (map[string]uuid.UUID, error) {
	rows, err := r.q.ListInstallmentPlans(ctx, ListInstallmentPlansParams{UserID: userID, Keys: keys})
	if err != nil {
		return nil, err
	}
	out := make(map[string]uuid.UUID, len(rows))
	for _, row := range rows {
		out[string(row.PlanKey)] = row.PlanID
	}
	return out, nil
}

func (r *Repository) SaveInstallmentPlan(ctx context.Context, userID int64, accountID uuid.UUID, key []byte, planID uuid.UUID) error {
	return r.q.SaveInstallmentPlan(ctx, SaveInstallmentPlanParams{UserID: userID, AccountID: accountID, PlanKey: key, PlanID: planID})
}
