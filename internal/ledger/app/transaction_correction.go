package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// correctIn is CorrectTransaction inside the database transaction of r.
func (s *Service) correctIn(
	ctx context.Context,
	r Repository,
	booksID int64,
	id uuid.UUID,
	expectedVersion int,
	next domain.Transaction,
	reason string,
) (domain.Transaction, error) {
	prev, err := r.LockTransaction(ctx, booksID, id)
	if err != nil {
		return domain.Transaction{}, err
	}

	// A corporate action is voided and recorded again (A228 IO27).
	if prev.CorporateAction != nil {
		return domain.Transaction{}, ErrInvestmentTransaction
	}

	// A trade or an income is corrected only through its order (A227 IC1).
	if (prev.Trade == nil) != (next.Trade == nil) || (prev.Income == nil) != (next.Income == nil) {
		return domain.Transaction{}, ErrInvestmentTransaction
	}

	if err := checkLaterSales(ctx, r, booksID, prev.Date, prev.Postings, id, true); err != nil {
		return domain.Transaction{}, err
	}

	next.ID, next.BooksID = id, booksID
	if next.BalancingCurrency == "" {
		next.BalancingCurrency = prev.BalancingCurrency
	}

	accounts, err := s.references(ctx, r, next)
	if err != nil {
		return domain.Transaction{}, err
	}

	if err := s.addAccounts(ctx, r, booksID, accounts, prev); err != nil {
		return domain.Transaction{}, err
	}

	if err := s.applyCorrection(ctx, r, prev, next, expectedVersion, accounts, reason); err != nil {
		return domain.Transaction{}, err
	}

	return s.publishCorrected(ctx, r, booksID, id, prev, accounts)
}

// applyCorrection stores next as the version after prev.
func (s *Service) applyCorrection(
	ctx context.Context,
	r Repository,
	prev, next domain.Transaction,
	expectedVersion int,
	accounts map[uuid.UUID]domain.Account,
	reason string,
) error {
	var err error
	if prev.HasInstallments() {
		// The postings keep their rows: the plan and the statements stay as they are.
		var corrected domain.Transaction
		if corrected, err = prev.CorrectDetails(next, expectedVersion); err == nil {
			err = r.ReplaceCategoryPostings(ctx, prev, corrected, reason)
		}
	} else {
		_, err = s.correct(ctx, r, prev, next, expectedVersion, accounts, reason)
	}

	return err
}

// publishCorrected reloads the stored transaction and publishes its correction.
func (s *Service) publishCorrected(
	ctx context.Context,
	r Repository,
	booksID int64,
	id uuid.UUID,
	prev domain.Transaction,
	accounts map[uuid.UUID]domain.Account,
) (domain.Transaction, error) {
	// The stored postings carry the ids the database assigned.
	corrected, err := r.Transaction(ctx, booksID, id)
	if err != nil {
		return domain.Transaction{}, err
	}

	return corrected, r.Publish(ctx, outbox.Event{
		Type: EventTransactionCorrected, BooksID: booksID, AggregateID: id.String(),
		Payload: func() TransactionEvent {
			e := newTransactionEvent(corrected, accounts, prev)
			e.PreviousDate = prev.Date.Format(time.DateOnly)
			e.CategoriesChanged = domain.CategoriesChanged(prev, corrected, accounts)

			return e
		}(),
	})
}

// correct validates, bills and stores next as the version after prev.
func (s *Service) correct(
	ctx context.Context,
	r Repository,
	prev, next domain.Transaction,
	expectedVersion int,
	accounts map[uuid.UUID]domain.Account,
	reason string,
) (domain.Transaction, error) {
	corrected, err := prev.Correct(next, expectedVersion, accounts)
	if err != nil {
		return domain.Transaction{}, err
	}

	if err := checkLaterSales(
		ctx,
		r,
		prev.BooksID,
		corrected.Date,
		corrected.Postings,
		prev.ID,
		true,
	); err != nil {
		return domain.Transaction{}, err
	}

	if err := s.bill(ctx, r, &corrected); err != nil {
		return domain.Transaction{}, err
	}

	return corrected, r.ReplaceTransaction(ctx, prev, corrected, reason)
}

// voidIn is VoidTransaction inside the database transaction of r.
func (s *Service) voidIn(
	ctx context.Context,
	r Repository,
	booksID int64,
	id uuid.UUID,
	reason string,
) error {
	prev, err := r.LockTransaction(ctx, booksID, id)
	if err != nil {
		return err
	}

	if err := checkLaterSales(ctx, r, booksID, prev.Date, prev.Postings, id, true); err != nil {
		return err
	}

	voided, err := prev.Void(s.clock.Now(), reason)
	if err != nil {
		return err
	}

	if err := r.VoidTransaction(ctx, voided); err != nil {
		return err
	}

	accounts, err := r.Accounts(ctx, booksID, postingAccounts(prev))
	if err != nil {
		return err
	}

	return r.Publish(ctx, outbox.Event{
		Type: EventTransactionVoided, BooksID: booksID, AggregateID: id.String(),
		Payload: newTransactionEvent(voided, accounts),
	})
}
