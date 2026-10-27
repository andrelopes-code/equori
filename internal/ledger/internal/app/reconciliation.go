package app

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/page"

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
	SourceManual     = "manual"
	SourceImport     = "import"
	SourceAggregator = "aggregator"
)

// AssertBalance records the institution's balance of a leaf balance account (A9) and
// reconciles the account when the settled balance matches, after recording yield (F6, A10).
func (s *Service) AssertBalance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, amount money.Money, source string) (AssertionResult, error) {
	switch source {
	case "":
		source = SourceManual
	case SourceManual, SourceImport, SourceAggregator:
	default:
		return AssertionResult{}, validationError("source", "must be manual, import or aggregator")
	}
	if date.After(s.clock.Today()) {
		return AssertionResult{}, validationError("date", "must not be in the future")
	}
	var res AssertionResult
	err := s.repo.InTx(ctx, func(r Repository) error {
		a, err := s.lockAssertionTarget(ctx, r, userID, accountID, date, amount)
		if err != nil {
			return err
		}
		res, err = s.decideAssertion(ctx, r, a, date, amount, source, false, nil)
		return err
	})
	return res, err
}

// AssertSynced records an aggregator's balance and decides it. A repeated report of a
// balance already asserted by the aggregator inserts nothing and decides the open assertions
// of that date and amount again, because history recorded since may close the difference (A77).
// A reserve may book bounded yield (D3, A75). The result is that of the newest assertion of
// the date and amount: the list orders by creation, newest first.
func (s *Service) AssertSynced(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, amount money.Money, reserve bool) (AssertionResult, error) {
	if date.After(s.clock.Today()) {
		return AssertionResult{}, validationError("date", "must not be in the future")
	}
	var res AssertionResult
	err := s.repo.InTx(ctx, func(r Repository) error {
		a, err := s.lockAssertionTarget(ctx, r, userID, accountID, date, amount)
		if err != nil {
			return err
		}
		assertions, err := r.BalanceAssertions(ctx, userID, accountID)
		if err != nil {
			return err
		}
		if reserve {
			if err := s.redecideOpenReserve(ctx, r, a, date, assertions); err != nil {
				return err
			}
		}
		var repeated bool
		for _, found := range assertions {
			if found.Source != SourceAggregator || !found.Date.Equal(date) || found.Amount != amount.Amount() {
				continue
			}
			newest := !repeated
			repeated = true
			if found.Reconciled {
				if newest {
					res.Assertion = found
				}
				continue
			}
			decided, err := s.decideAssertion(ctx, r, a, date, amount, SourceAggregator, reserve, &found)
			if err != nil {
				return err
			}
			if newest {
				res = decided
			}
		}
		if repeated {
			return nil
		}
		res, err = s.decideAssertion(ctx, r, a, date, amount, SourceAggregator, reserve, nil)
		return err
	})
	return res, err
}

// redecideOpenReserve decides again, oldest date first, the open aggregator assertions of a
// reserve dated after its last reconciliation and before date: a transfer recorded after the
// sync of its day closes that day's difference, and each day books its own yield within its own
// bound (D3 amendment). Of one date, only the newest assertion that reconciles counts.
func (s *Service) redecideOpenReserve(ctx context.Context, r Repository, a domain.Account, date time.Time, assertions []BalanceAssertion) error {
	last, err := r.LastReconciledOn(ctx, a.UserID, a.ID)
	if err != nil {
		return err
	}
	open := slices.DeleteFunc(slices.Clone(assertions), func(b BalanceAssertion) bool {
		return b.Source != SourceAggregator || b.Reconciled || !b.Date.Before(date)
	})
	slices.SortStableFunc(open, func(x, y BalanceAssertion) int { return x.Date.Compare(y.Date) })
	for _, found := range open {
		if last != nil && !found.Date.After(*last) {
			continue
		}
		amount, err := money.New(found.Amount, a.Instrument)
		if err != nil {
			return err
		}
		decided, err := s.decideAssertion(ctx, r, a, found.Date, amount, SourceAggregator, true, &found)
		if err != nil {
			return err
		}
		if decided.Assertion.Reconciled {
			last = &found.Date
		}
	}
	return nil
}

// lockAssertionTarget locks the account and checks that an assertion of date and amount may
// be decided on it.
func (s *Service) lockAssertionTarget(ctx context.Context, r Repository, userID int64, accountID uuid.UUID, date time.Time, amount money.Money) (domain.Account, error) {
	a, err := s.lockLeafBalance(ctx, r, userID, accountID)
	if err != nil {
		return domain.Account{}, err
	}
	if amount.Currency() != a.Instrument {
		return domain.Account{}, validationError("amount", "must be in the account currency")
	}
	last, err := r.LastReconciledOn(ctx, userID, accountID)
	if err != nil {
		return domain.Account{}, err
	}
	return a, domain.CheckAssertionDate(date, last)
}

// decideAssertion compares the settled balance with the asserted amount and reconciles the
// account when they match. An existing assertion is decided again; a nil one is inserted.
// An aggregator's assertion books yield only when reserve is set (A75).
func (s *Service) decideAssertion(ctx context.Context, r Repository, a domain.Account, date time.Time, amount money.Money, source string, reserve bool, existing *BalanceAssertion) (AssertionResult, error) {
	var res AssertionResult
	prev, err := s.previousAssertionDate(ctx, r, a.UserID, a.ID, date)
	if err != nil {
		return res, err
	}
	start, err := s.yieldStart(ctx, r, a, date, prev)
	if err != nil {
		return res, err
	}
	settled, err := r.BalanceAt(ctx, a.UserID, a.ID, date, BasisSettled)
	if err != nil {
		return res, err
	}
	var outcome domain.AssertionOutcome
	switch {
	case reserve:
		days := 0
		if prev != nil {
			days = int(date.Sub(*prev) / (24 * time.Hour))
		}
		outcome = domain.DecideSyncedReserve(amount.Amount(), settled, days, a.YieldMode, s.defaults.ReserveYieldPercent(a.Instrument))
	case source == SourceAggregator:
		// P6 A42: yield arrives as feed lines; a line the feed lacks today is not yield.
		outcome = domain.DecideAssertion(amount.Amount(), settled, domain.YieldNone)
	default:
		outcome = domain.DecideAssertion(amount.Amount(), settled, a.YieldMode)
	}
	if outcome.Resolution == domain.ResolutionYield && start == nil {
		outcome = domain.AssertionOutcome{Difference: outcome.Difference}
	}
	if existing != nil {
		res.Assertion = *existing
	} else if res.Assertion, err = r.InsertBalanceAssertion(ctx, BalanceAssertion{
		UserID: a.UserID, AccountID: a.ID, Date: date, Amount: amount.Amount(), Source: source,
	}); err != nil {
		return res, err
	}
	if res.Difference, err = money.New(outcome.Difference, a.Instrument); err != nil {
		return res, err
	}
	if outcome.Resolution == "" {
		return res, nil
	}
	if outcome.Resolution == domain.ResolutionYield {
		if res.ResolutionTransactionID, err = s.recordYield(ctx, r, a, *start, date, outcome.Yield); err != nil {
			return res, err
		}
	}
	res.Resolution = outcome.Resolution
	if err := s.reconcile(ctx, r, Reconciliation{
		UserID: a.UserID, AccountID: a.ID, Date: date, AssertionID: res.Assertion.ID,
		Difference: outcome.Difference, Resolution: outcome.Resolution, ResolutionTransactionID: res.ResolutionTransactionID,
	}); err != nil {
		return res, err
	}
	res.Assertion.Reconciled = true
	return res, nil
}

// ResolveAssertion settles the open difference of an assertion chosen by the owner (F6, S26).
func (s *Service) ResolveAssertion(ctx context.Context, userID int64, id uuid.UUID, resolution domain.Resolution) (AssertionResult, error) {
	if resolution != domain.ResolutionAdjustment && resolution != domain.ResolutionYield && resolution != domain.ResolutionTransactionsAdded {
		return AssertionResult{}, validationError("resolution", "must be adjustment, yield or transactions_added")
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
			if resolution == domain.ResolutionYield {
				res.ResolutionTransactionID, err = s.resolveAsYield(ctx, r, a, res.Assertion.Date, res.Difference)
			} else {
				res.ResolutionTransactionID, err = s.recordAdjustment(ctx, r, a, res.Assertion.Date, res.Difference)
			}
			if err != nil {
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

// ReconcileStatement confirms the institution's amount due for a closed card statement (A7).
func (s *Service) ReconcileStatement(ctx context.Context, userID int64, statementID uuid.UUID, amountDue money.Money) error {
	accountID, err := s.repo.StatementAccount(ctx, userID, statementID)
	if err != nil {
		return err
	}
	return s.repo.InTx(ctx, func(r Repository) error {
		if _, err := r.LockAccount(ctx, userID, accountID); err != nil {
			return err
		}
		v, card, err := s.statementView(ctx, r, userID, statementID)
		if err != nil {
			return err
		}
		if amountDue.Currency() != card.Instrument {
			return validationError("amount_due", "must be in the card currency")
		}
		if s.clock.Today().Before(v.Input.Closing) {
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
			UserID: userID, AccountID: accountID, Date: v.Input.Closing, StatementID: statementID, Resolution: domain.ResolutionNone,
		})
	})
}

func (s *Service) BalanceAssertions(ctx context.Context, userID int64, accountID uuid.UUID, p page.Request[AssertionKey]) ([]BalanceAssertion, *AssertionKey, error) {
	if _, err := s.repo.Account(ctx, userID, accountID); err != nil {
		return nil, nil, err
	}
	return s.repo.BalanceAssertionPage(ctx, userID, accountID, p)
}

// lockLeafBalance serializes the reconciliations of one account.
func (s *Service) lockLeafBalance(ctx context.Context, r Repository, userID int64, accountID uuid.UUID) (domain.Account, error) {
	a, err := r.LockAccount(ctx, userID, accountID)
	if err != nil {
		return domain.Account{}, err
	}
	return a, checkLeafBalance(ctx, r, a)
}

// checkLeafBalance accepts the accounts an institution reports on: balance accounts without
// sub-accounts (P3 amendment A9).
func checkLeafBalance(ctx context.Context, r Repository, a domain.Account) error {
	if !a.IsBalance() {
		return validationError("account_id", "must be a balance account")
	}
	parent, err := r.AccountHasChildren(ctx, a.UserID, a.ID)
	if err != nil {
		return err
	}
	if parent {
		return validationError("account_id", "must not be a parent account")
	}
	return nil
}

// previousAssertionDate is the date of the latest assertion dated before date; nil when
// there is none.
func (s *Service) previousAssertionDate(ctx context.Context, r Repository, userID int64, accountID uuid.UUID, date time.Time) (*time.Time, error) {
	assertions, err := r.BalanceAssertions(ctx, userID, accountID)
	if err != nil {
		return nil, err
	}
	for _, prev := range assertions {
		if prev.Date.Before(date) {
			return &prev.Date, nil
		}
	}
	return nil, nil
}

// yieldStart is the first day of the yield period (A10): the day after the previous
// assertion, else the account's first settlement date; nil when the account has no history.
func (s *Service) yieldStart(ctx context.Context, r Repository, a domain.Account, date time.Time, prev *time.Time) (*time.Time, error) {
	if prev != nil {
		start := prev.AddDate(0, 0, 1)
		return &start, nil
	}
	first, err := r.FirstSettledOn(ctx, a.UserID, a.ID)
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
	prev, err := s.previousAssertionDate(ctx, r, a.UserID, a.ID, date)
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
	mark := func() error { return r.ReconcilePostings(ctx, rec.UserID, rec.AccountID, rec.Date) }
	if rec.StatementID != uuid.Nil {
		mark = func() error { return r.ReconcileStatementPostings(ctx, rec.UserID, rec.StatementID) }
	}
	if err := mark(); err != nil {
		return err
	}
	return r.Publish(ctx, outbox.Event{
		Type: EventAccountReconciled, UserID: rec.UserID, AggregateID: rec.AccountID.String(),
		Payload: AccountReconciledEvent{AccountID: rec.AccountID, Date: rec.Date.Format(time.DateOnly)},
	})
}
