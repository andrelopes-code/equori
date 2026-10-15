package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

const EventAccountReconciled = "ledger.account_reconciled.v1"

type AccountReconciledEvent struct {
	AccountID uuid.UUID `json:"account_id"`
	Date      string    `json:"date"`
}

type AssertionResult struct {
	Assertion               BalanceAssertion
	Difference              money.Money
	Resolution              domain.Resolution // empty while the difference stays open
	ResolutionTransactionID uuid.UUID
}

const (
	SourceManual      = "manual"
	SourceImport      = "import"
	SourceOpenFinance = "open_finance"
)

// AssertBalance records the institution's balance of a leaf balance account (A9) and
// reconciles the account when the settled balance matches, after recording yield (F6, A10).
func (s *Service) AssertBalance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, amount money.Money, source string) (AssertionResult, error) {
	switch source {
	case "":
		source = SourceManual
	case SourceManual, SourceImport, SourceOpenFinance:
	default:
		return AssertionResult{}, validationError("source", "must be manual, import or open_finance")
	}
	if date.After(s.clock.Today()) {
		return AssertionResult{}, validationError("date", "must not be in the future")
	}
	var res AssertionResult
	err := s.repo.InTx(ctx, func(r Repository) error {
		a, err := s.lockLeafBalance(ctx, r, userID, accountID)
		if err != nil {
			return err
		}
		if amount.Currency() != a.Instrument {
			return validationError("amount", "must be in the account currency")
		}
		last, err := r.LastReconciledOn(ctx, userID, accountID)
		if err != nil {
			return err
		}
		if err := domain.CheckAssertionDate(date, last); err != nil {
			return err
		}
		start, err := s.yieldStart(ctx, r, userID, accountID, date)
		if err != nil {
			return err
		}
		settled, err := r.BalanceAt(ctx, userID, accountID, date, BasisSettled)
		if err != nil {
			return err
		}
		outcome := domain.DecideAssertion(amount.Amount(), settled, a.YieldMode)
		if outcome.Resolution == domain.ResolutionYield && start == nil {
			outcome = domain.AssertionOutcome{Difference: outcome.Difference}
		}
		if res.Assertion, err = r.InsertBalanceAssertion(ctx, BalanceAssertion{
			UserID: userID, AccountID: accountID, Date: date, Amount: amount.Amount(), Source: source,
		}); err != nil {
			return err
		}
		if res.Difference, err = money.New(outcome.Difference, a.Instrument); err != nil {
			return err
		}
		if outcome.Resolution == "" {
			return nil
		}
		if outcome.Resolution == domain.ResolutionYield {
			if res.ResolutionTransactionID, err = s.recordYield(ctx, r, a, *start, date, outcome.Yield); err != nil {
				return err
			}
		}
		res.Resolution = outcome.Resolution
		return s.reconcile(ctx, r, Reconciliation{
			UserID: userID, AccountID: accountID, Date: date, AssertionID: res.Assertion.ID,
			Difference: outcome.Difference, Resolution: outcome.Resolution, ResolutionTransactionID: res.ResolutionTransactionID,
		})
	})
	return res, err
}

// ResolveAssertion settles the open difference of an assertion chosen by the owner (F6, S26).
func (s *Service) ResolveAssertion(ctx context.Context, userID int64, id uuid.UUID, resolution domain.Resolution) (AssertionResult, error) {
	if resolution != domain.ResolutionAdjustment && resolution != domain.ResolutionTransactionsAdded {
		return AssertionResult{}, validationError("resolution", "must be adjustment or transactions_added")
	}
	found, err := s.repo.BalanceAssertion(ctx, userID, id)
	if err != nil {
		return AssertionResult{}, err
	}
	var res AssertionResult
	err = s.repo.InTx(ctx, func(r Repository) error {
		a, err := s.lockLeafBalance(ctx, r, userID, found.AccountID)
		if err != nil {
			return err
		}
		// Reread under the account lock: every reconciliation of the account holds it.
		if res.Assertion, err = r.BalanceAssertion(ctx, userID, id); err != nil {
			return err
		}
		if res.Assertion.Reconciled {
			return domain.ErrAlreadyReconciled
		}
		last, err := r.LastReconciledOn(ctx, userID, a.ID)
		if err != nil {
			return err
		}
		if err := domain.CheckAssertionDate(res.Assertion.Date, last); err != nil {
			return err
		}
		settled, err := r.BalanceAt(ctx, userID, a.ID, res.Assertion.Date, BasisSettled)
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
			if res.ResolutionTransactionID, err = s.recordAdjustment(ctx, r, a, res.Assertion.Date, res.Difference); err != nil {
				return err
			}
		}
		res.Resolution, res.Assertion.Reconciled = resolution, true
		return s.reconcile(ctx, r, Reconciliation{
			UserID: userID, AccountID: a.ID, Date: res.Assertion.Date, AssertionID: id,
			Difference: res.Difference.Amount(), Resolution: resolution, ResolutionTransactionID: res.ResolutionTransactionID,
		})
	})
	return res, err
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
func (s *Service) ReconciliationStatus(ctx context.Context, userID int64, accountID uuid.UUID) (ReconciliationStatus, error) {
	a, err := s.repo.Account(ctx, userID, accountID)
	if err != nil {
		return ReconciliationStatus{}, err
	}
	var st ReconciliationStatus
	if st.LastReconciledOn, err = s.repo.LastReconciledOn(ctx, userID, accountID); err != nil {
		return ReconciliationStatus{}, err
	}
	assertions, err := s.repo.BalanceAssertions(ctx, userID, accountID)
	if err != nil || len(assertions) == 0 {
		return st, err
	}
	latest := assertions[0]
	if latest.Reconciled || (st.LastReconciledOn != nil && latest.Date.Before(*st.LastReconciledOn)) {
		return st, nil
	}
	settled, err := s.repo.BalanceAt(ctx, userID, accountID, latest.Date, BasisSettled)
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
func (s *Service) Unlock(ctx context.Context, userID int64, accountID uuid.UUID, from time.Time) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		if _, err := r.LockAccount(ctx, userID, accountID); err != nil {
			return err
		}
		return r.UnlockAccount(ctx, userID, accountID, from)
	})
}

func (s *Service) BalanceAssertions(ctx context.Context, userID int64, accountID uuid.UUID) ([]BalanceAssertion, error) {
	if _, err := s.repo.Account(ctx, userID, accountID); err != nil {
		return nil, err
	}
	return s.repo.BalanceAssertions(ctx, userID, accountID)
}

// lockLeafBalance serializes the reconciliations of one account.
func (s *Service) lockLeafBalance(ctx context.Context, r Repository, userID int64, accountID uuid.UUID) (domain.Account, error) {
	a, err := r.LockAccount(ctx, userID, accountID)
	if err != nil {
		return domain.Account{}, err
	}
	if !a.IsBalance() {
		return domain.Account{}, validationError("account_id", "must be a balance account")
	}
	parent, err := r.AccountHasChildren(ctx, userID, accountID)
	if err != nil {
		return domain.Account{}, err
	}
	if parent {
		return domain.Account{}, validationError("account_id", "must not be a parent account")
	}
	return a, nil
}

// yieldStart is the first day of the yield period (A10): the day after the previous
// assertion, else the account's first settlement date; nil when the account has no history.
func (s *Service) yieldStart(ctx context.Context, r Repository, userID int64, accountID uuid.UUID, date time.Time) (*time.Time, error) {
	assertions, err := r.BalanceAssertions(ctx, userID, accountID)
	if err != nil {
		return nil, err
	}
	for _, prev := range assertions {
		if prev.Date.Before(date) {
			start := prev.Date.AddDate(0, 0, 1)
			return &start, nil
		}
	}
	first, err := r.FirstSettledOn(ctx, userID, accountID)
	if err != nil || first == nil || first.After(date) {
		return nil, err
	}
	return first, nil
}

func (s *Service) recordYield(ctx context.Context, r Repository, a domain.Account, start, end time.Time, amount int64) (uuid.UUID, error) {
	income, err := r.SystemAccount(ctx, a.UserID, domain.RoleYield)
	if err != nil {
		return uuid.Nil, err
	}
	gain, err := money.New(amount, a.Instrument)
	if err != nil {
		return uuid.Nil, err
	}
	t, err := s.insert(ctx, r, domain.Transaction{
		UserID: a.UserID, Date: end, Origin: domain.OriginSystem,
		Description: "Yield " + start.Format(time.DateOnly) + " to " + end.Format(time.DateOnly),
		Postings:    []domain.Posting{{AccountID: a.ID, Amount: gain}, {AccountID: income.ID, Amount: gain.Neg()}},
	})
	return t.ID, err
}

func (s *Service) recordAdjustment(ctx context.Context, r Repository, a domain.Account, date time.Time, diff money.Money) (uuid.UUID, error) {
	equity, err := r.SystemAccount(ctx, a.UserID, domain.RoleAdjustments)
	if err != nil {
		return uuid.Nil, err
	}
	t, err := s.insert(ctx, r, domain.Transaction{
		UserID: a.UserID, Date: date, Origin: domain.OriginSystem, Description: "Balance adjustment",
		Postings: []domain.Posting{{AccountID: a.ID, Amount: diff}, {AccountID: equity.ID, Amount: diff.Neg()}},
	})
	return t.ID, err
}

func (s *Service) reconcile(ctx context.Context, r Repository, rec Reconciliation) error {
	if err := r.InsertReconciliation(ctx, rec); err != nil {
		return err
	}
	if err := r.ReconcilePostings(ctx, rec.UserID, rec.AccountID, rec.Date); err != nil {
		return err
	}
	return r.Publish(ctx, outbox.Event{
		Type: EventAccountReconciled, UserID: rec.UserID, AggregateID: rec.AccountID.String(),
		Payload: AccountReconciledEvent{AccountID: rec.AccountID, Date: rec.Date.Format(time.DateOnly)},
	})
}
