package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

const EventAccountReconciled = "ledger.account_reconciled.v1"

type AccountReconciledEvent struct {
	AccountID uuid.UUID `json:"account_id"`
	Date      string    `json:"date"`
}

type ReconciliationStatus struct {
	LastReconciledOn *time.Time
	Open             *OpenDifference
}

type OpenDifference struct {
	AssertionID uuid.UUID
	Date        time.Time
	Difference  money.Money
}

// ReconciliationStatus reports the latest assertion's difference while it is open and
// not superseded by a later reconciliation; the difference reflects the current postings.
func (s *Service) ReconciliationStatus(ctx context.Context, booksID int64, accountID uuid.UUID) (ReconciliationStatus, error) {
	a, err := s.repo.Account(ctx, booksID, accountID)
	if err != nil {
		return ReconciliationStatus{}, err
	}

	var st ReconciliationStatus
	if st.LastReconciledOn, err = s.repo.LastReconciledOn(ctx, booksID, accountID); err != nil {
		return ReconciliationStatus{}, err
	}

	assertions, err := s.repo.BalanceAssertions(ctx, booksID, accountID)
	if err != nil || len(assertions) == 0 {
		return st, err
	}

	latest := assertions[0]
	if latest.Reconciled || (st.LastReconciledOn != nil && latest.Date.Before(*st.LastReconciledOn)) {
		return st, nil
	}

	settled, err := s.repo.BalanceAt(ctx, booksID, accountID, latest.Date, BasisSettled)
	if err != nil {
		return ReconciliationStatus{}, err
	}

	diff, err := money.New(latest.Amount-settled, a.Instrument)
	if err != nil {
		return ReconciliationStatus{}, err
	}

	st.Open = &OpenDifference{AssertionID: latest.ID, Date: latest.Date, Difference: diff}

	return st, nil
}

// Unlock is the explicit step chapter 2 requires before reconciled postings change (A8).
func (s *Service) Unlock(ctx context.Context, booksID int64, accountID uuid.UUID, from time.Time) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		if _, err := r.LockAccount(ctx, booksID, accountID); err != nil {
			return err
		}

		return r.UnlockAccount(ctx, booksID, accountID, from)
	})
}

// ReconcileStatement confirms the institution's amount due for a closed card statement (A7).
func (s *Service) ReconcileStatement(ctx context.Context, booksID int64, statementID uuid.UUID, amountDue money.Money) error {
	accountID, err := s.repo.StatementAccount(ctx, booksID, statementID)
	if err != nil {
		return err
	}

	return s.repo.InTx(ctx, func(r Repository) error {
		if _, err := r.LockAccount(ctx, booksID, accountID); err != nil {
			return err
		}

		v, card, err := s.statementView(ctx, r, booksID, statementID)
		if err != nil {
			return err
		}

		if amountDue.Currency() != card.Instrument {
			return validationError("amount_due", "must be in the card currency")
		}

		if s.clock.Today(ctx).Before(v.Input.Closing) {
			return ErrStatementNotClosed
		}

		diff, err := money.New(amountDue.Amount()-v.Summary.AmountDue, card.Instrument)
		if err != nil {
			return err
		}

		if !diff.IsZero() {
			return fmt.Errorf("%w: %s", ErrDifferenceRemains, diff)
		}

		return s.reconcile(ctx, r, Reconciliation{
			BooksID: booksID, AccountID: accountID, Date: v.Input.Closing, StatementID: statementID, Resolution: domain.ResolutionNone,
		})
	})
}

// AccountCheck is an open leaf asset or liability account with the open difference of its
// latest balance assertion; Difference is nil without one or when it is zero (P12 A152).
type AccountCheck struct {
	ID           uuid.UUID
	Name         string
	Difference   *money.Money
	DifferenceOn time.Time
}

// AccountChecks lists every open leaf asset and liability account in AllAccounts order (A152).
func (s *Service) AccountChecks(ctx context.Context, booksID int64) ([]AccountCheck, error) {
	all, err := s.repo.AllAccounts(ctx, booksID)
	if err != nil {
		return nil, err
	}

	parents := make(map[uuid.UUID]bool, len(all))
	for _, a := range all {
		parents[a.ParentID] = true
	}

	var out []AccountCheck
	for _, a := range all {
		if (a.Class != domain.ClassAsset && a.Class != domain.ClassLiability) || a.ClosedOn != nil || parents[a.ID] {
			continue
		}

		st, err := s.ReconciliationStatus(ctx, booksID, a.ID)
		if err != nil {
			return nil, err
		}

		c := AccountCheck{ID: a.ID, Name: a.Name}
		if st.Open != nil && st.Open.Difference.Amount() != 0 {
			c.Difference, c.DifferenceOn = &st.Open.Difference, st.Open.Date
		}

		out = append(out, c)
	}

	return out, nil
}

func (s *Service) reconcile(ctx context.Context, r Repository, rec Reconciliation) error {
	if err := r.InsertReconciliation(ctx, rec); err != nil {
		return err
	}

	mark := func() error { return r.ReconcilePostings(ctx, rec.BooksID, rec.AccountID, rec.Date) }
	if rec.StatementID != uuid.Nil {
		mark = func() error { return r.ReconcileStatementPostings(ctx, rec.BooksID, rec.StatementID) }
	}

	if err := mark(); err != nil {
		return err
	}

	return r.Publish(ctx, outbox.Event{
		Type: EventAccountReconciled, BooksID: rec.BooksID, AggregateID: rec.AccountID.String(),
		Payload: AccountReconciledEvent{AccountID: rec.AccountID, Date: rec.Date.Format(time.DateOnly)},
	})
}
