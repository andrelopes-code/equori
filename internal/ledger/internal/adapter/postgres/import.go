package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
)

func (r *Repository) TransactionByExternalRecord(ctx context.Context, userID int64, recordID uuid.UUID) (uuid.UUID, error) {
	id, err := r.q.GetTransactionIDByExternalRecord(ctx, GetTransactionIDByExternalRecordParams{UserID: userID, ExternalRecordID: nullUUID(recordID)})
	return id, notFound(err)
}

func (r *Repository) UnlinkedPostings(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]app.UnlinkedPosting, error) {
	rows, err := r.q.ListUnlinkedPostings(ctx, ListUnlinkedPostingsParams{UserID: userID, AccountID: accountID, FromDate: from, ToDate: to})
	return mapAll(rows, func(row ListUnlinkedPostingsRow) app.UnlinkedPosting {
		return app.UnlinkedPosting{
			TransactionID: row.TransactionID, Date: row.BookedOn, Amount: row.Amount, PayeeID: row.PayeeID.UUID, Description: row.Description,
		}
	}), err
}

func (r *Repository) LinkExternalRecord(ctx context.Context, userID int64, postingID, recordID uuid.UUID) error {
	err := r.q.LinkExternalRecord(ctx, LinkExternalRecordParams{UserID: userID, ID: postingID, ExternalRecordID: nullUUID(recordID)})
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
		return app.ErrAlreadyMatched
	}
	return err
}

func (r *Repository) LockImportedPosting(ctx context.Context, userID int64, recordID uuid.UUID) (app.ImportedPostingState, error) {
	row, err := r.q.LockImportedPosting(ctx, LockImportedPostingParams{UserID: userID, ExternalRecordID: nullUUID(recordID)})
	if err != nil {
		return app.ImportedPostingState{}, notFound(err)
	}
	p := app.ImportedPostingState{ID: row.ID, AccountID: row.AccountID, Status: domain.PostingStatus(row.Status)}
	if row.CardRole != nil {
		p.CardRole = *row.CardRole
	}
	return p, nil
}

func (r *Repository) SettleImportedPosting(ctx context.Context, userID int64, postingID uuid.UUID, status domain.PostingStatus, statementID uuid.UUID) error {
	return r.q.SettleImportedPosting(ctx, SettleImportedPostingParams{UserID: userID, ID: postingID, Status: string(status), StatementID: nullUUID(statementID)})
}

func (r *Repository) ReleaseExternalRecord(ctx context.Context, userID int64, recordID uuid.UUID) error {
	return r.q.ReleaseExternalRecord(ctx, ReleaseExternalRecordParams{UserID: userID, ExternalRecordID: nullUUID(recordID)})
}

func (r *Repository) RecordPosting(ctx context.Context, userID int64, recordID uuid.UUID) (uuid.UUID, uuid.UUID, error) {
	row, err := r.q.GetRecordPosting(ctx, GetRecordPostingParams{UserID: userID, ExternalRecordID: nullUUID(recordID)})
	if err != nil {
		return uuid.Nil, uuid.Nil, notFound(err)
	}
	return row.TransactionID, row.InstallmentPlanID.UUID, nil
}

func (r *Repository) LockPlanInstallment(ctx context.Context, userID int64, planID uuid.UUID, number int) (app.PlanInstallmentState, error) {
	row, err := r.q.LockPlanInstallment(ctx, LockPlanInstallmentParams{UserID: userID, PlanID: planID, Number: installmentNumber(&domain.InstallmentRef{Number: number})})
	if err != nil {
		return app.PlanInstallmentState{}, notFound(err)
	}
	return app.PlanInstallmentState{
		PostingID: row.ID, TransactionID: row.TransactionID, Amount: row.Amount,
		RecordID: row.ExternalRecordID.UUID, Reversed: row.Reversed != nil && *row.Reversed,
	}, nil
}

func (r *Repository) StatementByDueDate(ctx context.Context, userID int64, accountID uuid.UUID, due time.Time) (domain.ReferenceMonth, error) {
	first, err := r.q.GetStatementByDueDate(ctx, GetStatementByDueDateParams{UserID: userID, AccountID: accountID, DueDate: due})
	if err != nil {
		return domain.ReferenceMonth{}, notFound(err)
	}
	return domain.MonthOf(first), nil
}

func (r *Repository) ClearPendingPostings(ctx context.Context, userID int64, txID, accountID uuid.UUID) error {
	return r.q.ClearPendingPostings(ctx, ClearPendingPostingsParams{UserID: userID, TransactionID: txID, AccountID: accountID})
}

func (r *Repository) TransactionsByExternalRecords(ctx context.Context, userID int64, recordIDs []uuid.UUID) (map[uuid.UUID]uuid.UUID, error) {
	rows, err := r.q.ListTransactionsByExternalRecords(ctx, ListTransactionsByExternalRecordsParams{UserID: userID, RecordIds: recordIDs})
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]uuid.UUID, len(rows))
	for _, row := range rows {
		out[row.ExternalRecordID] = row.TransactionID
	}
	return out, nil
}

func (r *Repository) LockAccountPostingLinks(ctx context.Context, userID int64, txID, accountID uuid.UUID) ([]app.PostingLink, error) {
	rows, err := r.q.LockAccountPostingLinks(ctx, LockAccountPostingLinksParams{UserID: userID, TransactionID: txID, AccountID: accountID})
	return mapAll(rows, func(row LockAccountPostingLinksRow) app.PostingLink {
		return app.PostingLink{PostingID: row.ID, RecordID: row.ExternalRecordID.UUID, Voided: row.Voided}
	}), err
}

func (r *Repository) PairingCandidates(ctx context.Context, q app.PairingQuery) ([]uuid.UUID, error) {
	return r.q.PairingCandidates(ctx, PairingCandidatesParams{
		UserID: q.UserID, TransactionID: q.TransactionID, AccountID: q.AccountID, Amount: q.Amount,
		FromDate: q.From, ToDate: q.To, ExcludedAccounts: q.ExcludedAccounts,
	})
}

func (r *Repository) ClearRecordLinks(ctx context.Context, userID int64, txID uuid.UUID) error {
	return r.q.ClearRecordLinks(ctx, ClearRecordLinksParams{UserID: userID, TransactionID: txID})
}
