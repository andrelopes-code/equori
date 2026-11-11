package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// lineReason is the version reason of a transaction corrected to its statement line (A101).
const lineReason = "matched to the institution's line"

// ConfirmLine corrects the transaction to the amount and date of the statement line matched
// to it on accountID, as a new version, keeping its description, payee, categories and tags
// (A101). A voided transaction is refused with ErrVoided.
func (s *Service) ConfirmLine(ctx context.Context, booksID int64, txID, accountID uuid.UUID, amount int64, date time.Time) error {
	tx, err := s.repo.Transaction(ctx, booksID, txID)
	if err != nil {
		return err
	}

	if tx.VoidedAt != nil {
		return domain.ErrVoided
	}

	next, changed, err := tx.ToLine(accountID, amount, date)
	if err != nil || !changed {
		return err
	}

	_, err = s.CorrectTransaction(ctx, booksID, txID, tx.Version, next, lineReason)

	return err
}

// MoveReconciledDate moves the transaction to date, its amount unchanged, as a new version
// with reason lineReason, when the posting on accountID is a card posting, every reconciled
// posting is a card posting and each keeps its statement after billing (P12 A147 rule 3).
// Otherwise domain.ErrReconciled; a voided transaction is domain.ErrVoided.
func (s *Service) MoveReconciledDate(ctx context.Context, booksID int64, txID, accountID uuid.UUID, date time.Time) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		prev, err := r.LockTransaction(ctx, booksID, txID)
		if err != nil {
			return err
		}

		if prev.Trade != nil || prev.Income != nil || prev.HasInstallments() {
			return domain.ErrReconciled
		}

		accounts := map[uuid.UUID]domain.Account{}
		if err := s.addAccounts(ctx, r, booksID, accounts, prev); err != nil {
			return err
		}

		next, changed, err := prev.MoveReconciledDate(accountID, date, accounts)
		if err != nil || !changed {
			return err
		}

		if err := s.bill(ctx, r, &next); err != nil {
			return err
		}

		if !prev.KeepsReconciledStatements(next) {
			return domain.ErrReconciled
		}

		if err := r.ReplaceReconciledTransaction(ctx, prev, next, lineReason); err != nil {
			return err
		}

		// The stored postings carry the ids the database assigned.
		corrected, err := r.Transaction(ctx, booksID, txID)
		if err != nil {
			return err
		}

		event := newTransactionEvent(corrected, accounts, prev)
		event.PreviousDate = prev.Date.Format(time.DateOnly)
		event.CategoriesChanged = domain.CategoriesChanged(prev, corrected, accounts)

		return r.Publish(ctx, outbox.Event{
			Type: EventTransactionCorrected, BooksID: booksID, AggregateID: txID.String(), Payload: event,
		})
	})
}
