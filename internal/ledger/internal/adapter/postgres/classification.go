package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
)

func (r *Repository) TransactionsByIDs(ctx context.Context, userID int64, ids []uuid.UUID) ([]domain.Transaction, error) {
	rows, err := r.q.GetTransactionsByIDs(ctx, GetTransactionsByIDsParams{UserID: userID, Ids: ids})
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return r.completeAll(ctx, userID, rows)
}

func (r *Repository) RawDescriptions(ctx context.Context, userID int64, ids []uuid.UUID) (map[uuid.UUID]string, error) {
	rows, err := r.q.RawDescriptions(ctx, RawDescriptionsParams{UserID: userID, Ids: ids})
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]string, len(rows))
	for _, row := range rows {
		out[row.TransactionID] = row.Description
	}
	return out, nil
}

func (r *Repository) AllAccounts(ctx context.Context, userID int64) ([]domain.Account, error) {
	rows, err := r.q.ListAllAccounts(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Account, len(rows))
	for i, row := range rows {
		out[i] = toAccount(row)
	}
	return out, nil
}

func (r *Repository) ExistingPayees(ctx context.Context, userID int64, ids []uuid.UUID) (map[uuid.UUID]struct{}, error) {
	found, err := r.q.ExistingPayees(ctx, ExistingPayeesParams{UserID: userID, Ids: ids})
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]struct{}, len(found))
	for _, id := range found {
		out[id] = struct{}{}
	}
	return out, nil
}

func (r *Repository) LatestPayeeCategories(ctx context.Context, userID int64, payees []uuid.UUID) (map[app.PayeeClass]uuid.UUID, error) {
	rows, err := r.q.LatestPayeeCategories(ctx, LatestPayeeCategoriesParams{UserID: userID, PayeeIds: payees})
	if err != nil {
		return nil, err
	}
	out := make(map[app.PayeeClass]uuid.UUID, len(rows))
	for _, row := range rows {
		out[app.PayeeClass{PayeeID: row.PayeeID, Class: row.AccountClass}] = row.AccountID
	}
	return out, nil
}
