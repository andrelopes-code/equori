package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ResolveAssertion settles the open difference of an assertion chosen by the owner (F6, S26).
func (s *Service) ResolveAssertion(ctx context.Context, booksID int64, id uuid.UUID, resolution domain.Resolution) (AssertionResult, error) {
	if resolution != domain.ResolutionAdjustment && resolution != domain.ResolutionYield && resolution != domain.ResolutionTransactionsAdded {
		return AssertionResult{}, validationError("resolution", "must be adjustment, yield or transactions_added")
	}

	found, err := s.repo.BalanceAssertion(ctx, booksID, id)
	if err != nil {
		return AssertionResult{}, err
	}

	var res AssertionResult
	err = s.repo.InTx(ctx, func(r Repository) error {
		a, err := s.loadOpenAssertion(ctx, r, booksID, id, found.AccountID, &res)
		if err != nil {
			return err
		}

		if err := s.resolveDifference(ctx, r, booksID, a, resolution, &res); err != nil {
			return err
		}

		res.Resolution, res.Assertion.Reconciled = resolution, true

		return s.reconcile(ctx, r, Reconciliation{
			BooksID: booksID, AccountID: a.ID, Date: res.Assertion.Date, AssertionID: id,
			Difference: res.Difference.Amount(), Resolution: resolution, ResolutionTransactionID: res.ResolutionTransactionID,
		})
	})

	return res, err
}

// loadOpenAssertion locks the account of the assertion and loads the assertion into res. It
// rejects a reconciled assertion and a date before the last reconciliation.
func (s *Service) loadOpenAssertion(
	ctx context.Context,
	r Repository,
	booksID int64,
	id, accountID uuid.UUID,
	res *AssertionResult,
) (domain.Account, error) {
	a, err := s.lockLeafBalance(ctx, r, booksID, accountID)
	if err != nil {
		return domain.Account{}, err
	}

	// Reread under the account lock: every reconciliation of the account holds it.
	if res.Assertion, err = r.BalanceAssertion(ctx, booksID, id); err != nil {
		return domain.Account{}, err
	}

	if res.Assertion.Reconciled {
		return domain.Account{}, domain.ErrAlreadyReconciled
	}

	last, err := r.LastReconciledOn(ctx, booksID, a.ID)
	if err != nil {
		return domain.Account{}, err
	}

	if err := domain.CheckAssertionDate(res.Assertion.Date, last); err != nil {
		return domain.Account{}, err
	}

	return a, nil
}

// resolveDifference computes the difference between the assertion and the settled balance, then
// records the resolution that closes it.
func (s *Service) resolveDifference(
	ctx context.Context,
	r Repository,
	booksID int64,
	a domain.Account,
	resolution domain.Resolution,
	res *AssertionResult,
) error {
	settled, err := r.BalanceAt(ctx, booksID, a.ID, res.Assertion.Date, BasisSettled)
	if err != nil {
		return err
	}

	if res.Difference, err = money.New(res.Assertion.Amount-settled, a.Instrument); err != nil {
		return err
	}

	if !res.Difference.IsZero() {
		if resolution == domain.ResolutionTransactionsAdded {
			return fmt.Errorf("%w: %s", ErrDifferenceRemains, res.Difference)
		}

		if resolution == domain.ResolutionYield {
			res.ResolutionTransactionID, err = s.resolveAsYield(ctx, r, a, res.Assertion.Date, res.Difference)
		} else {
			res.ResolutionTransactionID, err = s.recordAdjustment(ctx, r, a, res.Assertion.Date, res.Difference)
		}

		if err != nil {
			return err
		}
	}

	return nil
}

// yieldStart is the first day of the yield period (A10): the day after the previous
// assertion, else the account's first settlement date; nil when the account has no history.
func (s *Service) yieldStart(ctx context.Context, r Repository, a domain.Account, date time.Time, prev *time.Time) (*time.Time, error) {
	if prev != nil {
		start := prev.AddDate(0, 0, 1)
		return &start, nil
	}

	first, err := r.FirstSettledOn(ctx, a.BooksID, a.ID)
	if err != nil || first == nil || first.After(date) {
		return nil, err
	}

	return first, nil
}

// resolveAsYield books the positive difference chosen by the owner as yield, whatever the
// account's yield mode: the owner states that the institution credited it. A negative
// difference is a loss and resolves only as an adjustment.
func (s *Service) resolveAsYield(ctx context.Context, r Repository, a domain.Account, date time.Time, diff money.Money) (uuid.UUID, error) {
	if diff.Amount() < 0 {
		return uuid.Nil, validationError("resolution", "yield needs a positive difference; use adjustment")
	}

	prev, err := s.previousAssertionDate(ctx, r, a.BooksID, a.ID, date)
	if err != nil {
		return uuid.Nil, err
	}

	start, err := s.yieldStart(ctx, r, a, date, prev)
	if err != nil {
		return uuid.Nil, err
	}

	if start == nil {
		start = &date
	}

	return s.recordYield(ctx, r, a, *start, date, diff.Amount())
}

func (s *Service) recordYield(ctx context.Context, r Repository, a domain.Account, start, end time.Time, amount int64) (uuid.UUID, error) {
	income, err := r.SystemAccount(ctx, a.BooksID, domain.RoleYield)
	if err != nil {
		return uuid.Nil, err
	}

	gain, err := money.New(amount, a.Instrument)
	if err != nil {
		return uuid.Nil, err
	}

	w, err := s.writerFor(ctx, a.BooksID)
	if err != nil {
		return uuid.Nil, err
	}

	t, err := s.insert(ctx, r, domain.Transaction{
		BooksID: a.BooksID, Date: end, Origin: domain.OriginSystem, Description: w.yield(start, end),
		Postings: []domain.Posting{{AccountID: a.ID, Amount: gain}, {AccountID: income.ID, Amount: gain.Neg()}},
	})

	return t.ID, err
}

func (s *Service) recordAdjustment(ctx context.Context, r Repository, a domain.Account, date time.Time, diff money.Money) (uuid.UUID, error) {
	equity, err := r.SystemAccount(ctx, a.BooksID, domain.RoleAdjustments)
	if err != nil {
		return uuid.Nil, err
	}

	w, err := s.writerFor(ctx, a.BooksID)
	if err != nil {
		return uuid.Nil, err
	}

	t, err := s.insert(ctx, r, domain.Transaction{
		BooksID: a.BooksID, Date: date, Origin: domain.OriginSystem, Description: w.BalanceAdjustment,
		Postings: []domain.Posting{{AccountID: a.ID, Amount: diff}, {AccountID: equity.ID, Amount: diff.Neg()}},
	})

	return t.ID, err
}
