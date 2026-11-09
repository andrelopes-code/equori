package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

var ErrNotPairable = errors.New("the transaction cannot become the transfer of the line")

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
func (s *Service) Counterparts(ctx context.Context, booksID int64, q CounterpartQuery) ([]Counterpart, error) {
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
func (s *Service) PairImported(ctx context.Context, booksID int64, txID, accountID, recordID uuid.UUID) (int, error) {
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
				[]error{domain.ErrReconciled, domain.ErrValidation, domain.ErrVoided, domain.ErrNotCategorizable},
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
