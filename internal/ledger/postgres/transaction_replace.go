package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

// ReplaceReconciledTransaction bypasses the I05 trigger for the current database transaction
// only (P12 A147 rule 3).
func (r *Repository) ReplaceReconciledTransaction(
	ctx context.Context,
	prev, next domain.Transaction,
	reason string,
) error {
	if r.tx == nil {
		return errors.New("replace reconciled transaction outside a transaction")
	}

	if err := r.q.EnableReconciledUnlock(ctx); err != nil {
		return err
	}

	return r.ReplaceTransaction(ctx, prev, next, reason)
}

func (r *Repository) ReplaceTransaction(
	ctx context.Context,
	prev, next domain.Transaction,
	reason string,
) error {
	snapshot, err := json.Marshal(toSnapshot(prev))
	if err != nil {
		return err
	}

	if err := r.q.InsertVersion(ctx, InsertVersionParams{
		//nolint:gosec // version is a small positive counter.
		TransactionID: prev.ID, Version: int32(prev.Version), Snapshot: snapshot, Reason: reason,
	}); err != nil {
		return err
	}

	if err := r.q.DeletePostings(ctx, prev.ID); err != nil {
		return err
	}

	if err := r.q.DeleteTransactionTags(ctx, prev.ID); err != nil {
		return err
	}

	if err := r.q.DeleteLinksFrom(ctx, prev.ID); err != nil {
		return err
	}

	//nolint:gosec // version is a small positive counter.
	if err := r.q.UpdateTransaction(ctx, UpdateTransactionParams{
		BooksID:     next.BooksID,
		ID:          next.ID,
		Date:        next.Date,
		Description: next.Description,
		PayeeID:     nullUUID(next.PayeeID),
		BalancingCurrency: string(
			next.BalancingCurrency,
		),
		Origin:  string(next.Origin),
		Version: int32(next.Version),
	}); err != nil {
		return referenceError(err)
	}

	if err := r.writeChildren(ctx, next); err != nil {
		return err
	}

	return r.replaceDetail(ctx, prev, next)
}

// replaceDetail replaces the trade or income row of prev with the one of next (A227 IC7).
func (r *Repository) replaceDetail(ctx context.Context, prev, next domain.Transaction) error {
	if prev.Trade != nil {
		if err := r.q.DeleteTrade(ctx, DeleteTradeParams{
			BooksID:       prev.BooksID,
			TransactionID: prev.ID,
		}); err != nil {
			return err
		}
	}

	if prev.Income != nil {
		if err := r.q.DeleteInvestmentIncome(ctx, DeleteInvestmentIncomeParams{
			BooksID:       prev.BooksID,
			TransactionID: prev.ID,
		}); err != nil {
			return err
		}
	}

	if next.Trade != nil {
		return r.insertTrade(ctx, next)
	}

	if next.Income != nil {
		return r.insertIncome(ctx, next)
	}

	return nil
}

// ReplaceCategoryPostings deletes the postings of prev absent from next and inserts the
// postings of next without an id after the highest position left.
func (r *Repository) ReplaceCategoryPostings(
	ctx context.Context,
	prev, next domain.Transaction,
	reason string,
) error {
	snapshot, err := json.Marshal(toSnapshot(prev))
	if err != nil {
		return err
	}

	if err := r.q.InsertVersion(ctx, InsertVersionParams{
		//nolint:gosec // version is a small positive counter.
		TransactionID: prev.ID, Version: int32(prev.Version), Snapshot: snapshot, Reason: reason,
	}); err != nil {
		return err
	}

	removed := removedPostingIDs(prev, next)

	if err := r.q.DeletePostingsByID(
		ctx,
		DeletePostingsByIDParams{TransactionID: prev.ID, Ids: removed},
	); err != nil {
		return err
	}

	position, err := r.q.NextPostingPosition(ctx, prev.ID)
	if err != nil {
		return err
	}

	added := addedPostings(next)

	if err := r.insertPostings(ctx, next, added, position); err != nil {
		return err
	}

	if err := r.updateTransactionRow(ctx, next); err != nil {
		return err
	}

	if err := r.q.DeleteTransactionTags(ctx, prev.ID); err != nil {
		return err
	}

	return r.writeTags(ctx, next)
}

func removedPostingIDs(prev, next domain.Transaction) []uuid.UUID {
	var removed []uuid.UUID
	for _, p := range prev.Postings {
		if !slices.ContainsFunc(
			next.Postings,
			func(n domain.Posting) bool { return n.ID == p.ID },
		) {
			removed = append(removed, p.ID)
		}
	}

	return removed
}

func addedPostings(next domain.Transaction) []domain.Posting {
	var added []domain.Posting
	for _, p := range next.Postings {
		if p.ID == uuid.Nil {
			added = append(added, p)
		}
	}

	return added
}

func (r *Repository) updateTransactionRow(ctx context.Context, next domain.Transaction) error {
	//nolint:gosec // version is a small positive counter.
	if err := r.q.UpdateTransaction(ctx, UpdateTransactionParams{
		BooksID:     next.BooksID,
		ID:          next.ID,
		Date:        next.Date,
		Description: next.Description,
		PayeeID:     nullUUID(next.PayeeID),
		BalancingCurrency: string(
			next.BalancingCurrency,
		),
		Origin:  string(next.Origin),
		Version: int32(next.Version),
	}); err != nil {
		return referenceError(err)
	}

	return nil
}
