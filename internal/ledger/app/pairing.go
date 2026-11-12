package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

const reasonUnpaired = "unpaired"

var (
	ErrNotPairable   = errors.New("the transaction cannot become the transfer of the line")
	ErrNotUnpairable = errors.New("the paired transaction changed since the pairing")
)

// Counterpart is a transaction a sync line may pair with (A216 rule 2).
type Counterpart struct {
	TransactionID, AccountID, RecordID uuid.UUID
	CardPayment                        bool
}

// CounterpartQuery is a sync line on AccountID.
type CounterpartQuery struct {
	AccountID uuid.UUID
	Amount    money.Money
	Date      time.Time
}

// Counterparts lists the counterparts of the line by date then id, each a transaction that
// Transaction.Transfer accepts to the line's account (A216 rules 2.1 to 2.6).
func (s *Service) Counterparts(
	ctx context.Context,
	booksID int64,
	q CounterpartQuery,
) ([]Counterpart, error) {
	rows, err := s.repo.ImportCounterparts(
		ctx, booksID, q.AccountID, q.Amount.Currency(), q.Amount.Neg().Amount(),
		q.Date.AddDate(0, 0, -pairingWindowDays), q.Date.AddDate(0, 0, pairingWindowDays),
	)
	if err != nil {
		return nil, err
	}

	var out []Counterpart
	for _, c := range rows {
		t, err := s.repo.Transaction(ctx, booksID, c.TransactionID)
		if err != nil {
			return nil, err
		}

		target, accounts, err := s.transferAccounts(ctx, s.repo, booksID, q.AccountID, t)
		if err != nil {
			return nil, err
		}

		if _, err := t.Transfer(t.Version, target, uuid.Nil, accounts); err == nil {
			out = append(out, c)
		}
	}

	return out, nil
}

// PairImported makes txID the transfer of the line of recordID on accountID: its category or
// transit postings become one posting on accountID that recordID confirms (A218 rule 1). It
// returns the new version; ErrNotPairable when Transaction.Transfer refuses.
func (s *Service) PairImported(
	ctx context.Context,
	booksID int64,
	txID, accountID, recordID uuid.UUID,
) (int, error) {
	var version int

	err := s.repo.InTx(ctx, func(r Repository) error {
		c, err := r.LockTransaction(ctx, booksID, txID)
		if err != nil {
			return err
		}

		target, accounts, err := s.transferAccounts(ctx, r, booksID, accountID, c)
		if err != nil {
			return err
		}

		next, err := c.Transfer(c.Version, target, recordID, accounts)
		if err != nil {
			if slices.ContainsFunc(
				[]error{
					domain.ErrReconciled,
					domain.ErrValidation,
					domain.ErrVoided,
					domain.ErrNotCategorizable,
				},
				func(refusal error) bool { return errors.Is(err, refusal) },
			) {
				return ErrNotPairable
			}

			return err
		}

		version = next.Version

		return s.saveTransfer(ctx, r, c, next, accounts, Cause{})
	})

	return version, err
}

// UnpairImported returns txID, which a pairing left at version, to the postings of version-1
// as version+1 (A220 rule 2); ErrNotUnpairable when txID is not at version, the posting of
// recordID is reconciled, or the previous postings are refused.
func (s *Service) UnpairImported(
	ctx context.Context,
	booksID int64,
	txID, recordID uuid.UUID,
	version int,
) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		t, err := r.LockTransaction(ctx, booksID, txID)
		if err != nil {
			return err
		}

		versions, err := r.Versions(ctx, booksID, txID)
		if err != nil {
			return err
		}

		at := slices.IndexFunc(versions, func(v Version) bool { return v.Version == version-1 })
		if at < 0 {
			return ErrNotUnpairable
		}

		before := versions[at].Transaction

		accounts, err := r.Accounts(
			ctx,
			booksID,
			append(postingAccounts(t), postingAccounts(before)...),
		)
		if err != nil {
			return err
		}

		next, err := t.Unpair(version, recordID, before, accounts)
		if err != nil {
			if slices.ContainsFunc(
				[]error{
					domain.ErrReconciled,
					domain.ErrValidation,
					domain.ErrVoided,
					domain.ErrVersionConflict,
				},
				func(refusal error) bool { return errors.Is(err, refusal) },
			) {
				return ErrNotUnpairable
			}

			return err
		}

		return s.replaceUnpaired(ctx, r, t, next, accounts)
	})
}

// replaceUnpaired stores the unpaired version next of t and publishes the correction.
func (s *Service) replaceUnpaired(
	ctx context.Context,
	r Repository,
	t, next domain.Transaction,
	accounts map[uuid.UUID]domain.Account,
) error {
	if err := s.bill(ctx, r, &next); err != nil {
		return err
	}

	if err := r.ReplaceCategoryPostings(ctx, t, next, reasonUnpaired); err != nil {
		return err
	}

	event := newTransactionEvent(next, accounts, t)
	event.PreviousDate = t.Date.Format(time.DateOnly)
	event.CategoriesChanged = true

	return r.Publish(ctx, outbox.Event{
		Type:        EventTransactionCorrected,
		BooksID:     next.BooksID,
		AggregateID: next.ID.String(),
		Payload:     event,
	})
}
