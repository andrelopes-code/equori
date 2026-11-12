package ingestion

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/ledger"
)

func (p ledgerPort) PairLine(
	ctx context.Context,
	booksID int64,
	txID, accountID, recordID uuid.UUID,
) (int, error) {
	version, err := p.l.PairImported(ctx, booksID, txID, accountID, recordID)

	return version, p.translate(err)
}

func (p ledgerPort) UnpairLine(
	ctx context.Context,
	booksID int64,
	txID, recordID uuid.UUID,
	version int,
) error {
	return p.translate(p.l.UnpairImported(ctx, booksID, txID, recordID, version))
}

func (p ledgerPort) GroupableTransactions(
	ctx context.Context,
	booksID int64,
	txIDs []uuid.UUID,
) ([]uuid.UUID, error) {
	ids, err := p.l.GroupableTransactions(ctx, booksID, txIDs)

	return ids, p.translate(err)
}

func (p ledgerPort) ConfirmGroup(
	ctx context.Context,
	booksID int64,
	txID, accountID uuid.UUID,
	parts []app.GroupPart,
) error {
	out := make([]ledger.GroupPart, len(parts))
	for i, part := range parts {
		out[i] = ledger.GroupPart(part)
	}

	return p.translate(p.l.ConfirmGroup(ctx, booksID, txID, accountID, out))
}

func (p ledgerPort) ConfirmLine(
	ctx context.Context,
	booksID int64,
	txID, accountID uuid.UUID,
	amount int64,
	date time.Time,
) error {
	return p.translate(p.l.ConfirmLine(ctx, booksID, txID, accountID, amount, date))
}

func (p ledgerPort) MoveReconciledDate(
	ctx context.Context,
	booksID int64,
	txID, accountID uuid.UUID,
	date time.Time,
) error {
	return p.translate(p.l.MoveReconciledDate(ctx, booksID, txID, accountID, date))
}

func (p ledgerPort) UnlinkedPostings(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from, to time.Time,
) ([]domain.LedgerPosting, error) {
	ps, err := p.l.UnlinkedPostings(ctx, booksID, accountID, from, to)

	out := make([]domain.LedgerPosting, len(ps))
	for i, x := range ps {
		out[i] = domain.LedgerPosting{
			TransactionID: x.TransactionID,
			Date:          x.Date,
			Amount:        x.Amount,
			PayeeID:       x.PayeeID,
			Description:   x.Description,
		}
	}

	return out, p.translate(err)
}

func (p ledgerPort) UnconfirmedPostings(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from, to time.Time,
) ([]domain.LedgerPosting, error) {
	ps, err := p.l.UnconfirmedPostings(ctx, booksID, accountID, from, to)

	out := make([]domain.LedgerPosting, len(ps))
	for i, x := range ps {
		out[i] = domain.LedgerPosting{
			TransactionID: x.TransactionID, Date: x.Date, Amount: x.Amount, PayeeID: x.PayeeID,
			Description: x.Description, StatementID: x.StatementID,
		}
	}

	return out, p.translate(err)
}

func (p ledgerPort) ClearMatched(
	ctx context.Context,
	booksID int64,
	ms []app.Match,
) ([]int, error) {
	matches := make([]ledger.Match, len(ms))
	for i, m := range ms {
		matches[i] = ledger.Match{
			RecordID:      m.RecordID,
			TransactionID: m.TransactionID,
			AccountID:     m.AccountID,
			KeepPending:   m.Pending,
		}
	}

	conflicts, err := p.l.ClearMatchedBatch(ctx, booksID, matches)

	return conflicts, p.translate(err)
}

func (p ledgerPort) UpdateImportedPosting(
	ctx context.Context,
	booksID int64,
	recordID uuid.UUID,
	pending bool,
	dueDate *time.Time,
	kind string,
) (bool, error) {
	changed, err := p.l.UpdateImportedPosting(
		ctx,
		booksID,
		recordID,
		ledger.ImportedUpdate{Pending: pending, DueDate: dueDate, Kind: kind},
	)

	return changed, p.translate(err)
}

func (p ledgerPort) ReleaseRecord(ctx context.Context, booksID int64, recordID uuid.UUID) error {
	return p.translate(p.l.ReleaseRecord(ctx, booksID, recordID))
}
