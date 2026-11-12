package app

import (
	"context"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

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
func (s *Service) AssertBalance(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	amount money.Money,
	source string,
) (AssertionResult, error) {
	switch source {
	case "":
		source = SourceManual
	case SourceManual, SourceImport, SourceAggregator:
	default:
		return AssertionResult{}, validationError("source", "must be manual, import or aggregator")
	}

	if date.After(s.clock.Today(ctx)) {
		return AssertionResult{}, validationError("date", "must not be in the future")
	}

	var res AssertionResult
	err := s.repo.InTx(ctx, func(r Repository) error {
		a, err := s.lockAssertionTarget(ctx, r, booksID, accountID, date, amount)
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
func (s *Service) AssertSynced(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	amount money.Money,
	reserve bool,
) (AssertionResult, error) {
	if date.After(s.clock.Today(ctx)) {
		return AssertionResult{}, validationError("date", "must not be in the future")
	}

	var res AssertionResult
	err := s.repo.InTx(ctx, func(r Repository) error {
		a, err := s.lockAssertionTarget(ctx, r, booksID, accountID, date, amount)
		if err != nil {
			return err
		}

		assertions, err := r.BalanceAssertions(ctx, booksID, accountID)
		if err != nil {
			return err
		}

		if reserve {
			if err := s.redecideOpenReserve(ctx, r, a, date, assertions); err != nil {
				return err
			}
		}

		repeated, err := s.decideRepeated(ctx, r, a, date, amount, reserve, assertions, &res)
		if err != nil {
			return err
		}

		if repeated {
			return nil
		}

		res, err = s.decideAssertion(ctx, r, a, date, amount, SourceAggregator, reserve, nil)

		return err
	})

	return res, err
}

// decideRepeated decides each aggregator assertion already stored for date and amount. res takes
// the newest one. It reports whether any exists.
func (s *Service) decideRepeated(
	ctx context.Context,
	r Repository,
	a domain.Account,
	date time.Time,
	amount money.Money,
	reserve bool,
	assertions []BalanceAssertion,
	res *AssertionResult,
) (bool, error) {
	var repeated bool
	for _, found := range assertions {
		if found.Source != SourceAggregator || !found.Date.Equal(date) ||
			found.Amount != amount.Amount() {
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

		decided, err := s.decideAssertion(
			ctx,
			r,
			a,
			date,
			amount,
			SourceAggregator,
			reserve,
			&found,
		)
		if err != nil {
			return false, err
		}

		if newest {
			*res = decided
		}
	}

	return repeated, nil
}

func (s *Service) BalanceAssertions(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	p page.Request[AssertionKey],
) ([]BalanceAssertion, *AssertionKey, error) {
	if _, err := s.repo.Account(ctx, booksID, accountID); err != nil {
		return nil, nil, err
	}

	return s.repo.BalanceAssertionPage(ctx, booksID, accountID, p)
}

// redecideOpenReserve decides again, oldest date first, the open aggregator assertions of a
// reserve dated after its last reconciliation and before date: a transfer recorded after the
// sync of its day closes that day's difference, and each day books its own yield within its own
// bound (D3 amendment). Of one date, only the newest assertion that reconciles counts.
func (s *Service) redecideOpenReserve(
	ctx context.Context,
	r Repository,
	a domain.Account,
	date time.Time,
	assertions []BalanceAssertion,
) error {
	last, err := r.LastReconciledOn(ctx, a.BooksID, a.ID)
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

		decided, err := s.decideAssertion(
			ctx,
			r,
			a,
			found.Date,
			amount,
			SourceAggregator,
			true,
			&found,
		)
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
func (s *Service) lockAssertionTarget(
	ctx context.Context,
	r Repository,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	amount money.Money,
) (domain.Account, error) {
	a, err := s.lockLeafBalance(ctx, r, booksID, accountID)
	if err != nil {
		return domain.Account{}, err
	}

	if amount.Currency() != a.Instrument {
		return domain.Account{}, validationError("amount", "must be in the account currency")
	}

	last, err := r.LastReconciledOn(ctx, booksID, accountID)
	if err != nil {
		return domain.Account{}, err
	}

	return a, domain.CheckAssertionDate(date, last)
}

// decideAssertion compares the settled balance with the asserted amount and reconciles the
// account when they match. An existing assertion is decided again; a nil one is inserted.
// An aggregator's assertion books yield only when reserve is set (A75).
func (s *Service) decideAssertion(
	ctx context.Context,
	r Repository,
	a domain.Account,
	date time.Time,
	amount money.Money,
	source string,
	reserve bool,
	existing *BalanceAssertion,
) (AssertionResult, error) {
	var res AssertionResult

	prev, err := s.previousAssertionDate(ctx, r, a.BooksID, a.ID, date)
	if err != nil {
		return res, err
	}

	start, err := s.yieldStart(ctx, r, a, date, prev)
	if err != nil {
		return res, err
	}

	settled, err := r.BalanceAt(ctx, a.BooksID, a.ID, date, BasisSettled)
	if err != nil {
		return res, err
	}

	outcome := s.assertionOutcome(a, amount, source, reserve, prev, date, settled)

	if outcome.Resolution == domain.ResolutionYield && start == nil {
		outcome = domain.AssertionOutcome{Difference: outcome.Difference}
	}

	if existing != nil {
		res.Assertion = *existing
	} else if res.Assertion, err = r.InsertBalanceAssertion(ctx, BalanceAssertion{
		BooksID: a.BooksID, AccountID: a.ID, Date: date, Amount: amount.Amount(), Source: source,
	}); err != nil {
		return res, err
	}

	if res.Difference, err = money.New(outcome.Difference, a.Instrument); err != nil {
		return res, err
	}

	if outcome.Resolution == "" {
		return res, nil
	}

	if err := s.resolveOutcome(ctx, r, a, date, start, outcome, &res); err != nil {
		return res, err
	}

	return res, nil
}

// assertionOutcome decides the resolution of a stated balance against the settled one.
func (s *Service) assertionOutcome(
	a domain.Account,
	amount money.Money,
	source string,
	reserve bool,
	prev *time.Time,
	date time.Time,
	settled int64,
) domain.AssertionOutcome {
	var outcome domain.AssertionOutcome
	switch {
	case reserve:
		days := 0
		if prev != nil {
			days = int(date.Sub(*prev) / (24 * time.Hour))
		}

		outcome = domain.DecideSyncedReserve(
			amount.Amount(),
			settled,
			days,
			a.YieldMode,
			s.defaults.ReserveYieldPercent(a.Instrument),
		)
	case source == SourceAggregator:
		// P6 A42: yield arrives as feed lines; a line the feed lacks today is not yield.
		outcome = domain.DecideAssertion(amount.Amount(), settled, domain.YieldNone)
	default:
		outcome = domain.DecideAssertion(amount.Amount(), settled, a.YieldMode)
	}

	return outcome
}

// resolveOutcome records the yield of outcome when it has one, then reconciles the assertion.
func (s *Service) resolveOutcome(
	ctx context.Context,
	r Repository,
	a domain.Account,
	date time.Time,
	start *time.Time,
	outcome domain.AssertionOutcome,
	res *AssertionResult,
) error {
	var err error

	if outcome.Resolution == domain.ResolutionYield {
		if res.ResolutionTransactionID, err = s.recordYield(
			ctx,
			r,
			a,
			*start,
			date,
			outcome.Yield,
		); err != nil {
			return err
		}
	}

	res.Resolution = outcome.Resolution
	if err := s.reconcile(ctx, r, Reconciliation{
		BooksID:                 a.BooksID,
		AccountID:               a.ID,
		Date:                    date,
		AssertionID:             res.Assertion.ID,
		Difference:              outcome.Difference,
		Resolution:              outcome.Resolution,
		ResolutionTransactionID: res.ResolutionTransactionID,
	}); err != nil {
		return err
	}

	res.Assertion.Reconciled = true

	return nil
}

// lockLeafBalance serializes the reconciliations of one account.
func (s *Service) lockLeafBalance(
	ctx context.Context,
	r Repository,
	booksID int64,
	accountID uuid.UUID,
) (domain.Account, error) {
	a, err := r.LockAccount(ctx, booksID, accountID)
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

	parent, err := r.AccountHasChildren(ctx, a.BooksID, a.ID)
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
func (s *Service) previousAssertionDate(
	ctx context.Context,
	r Repository,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
) (*time.Time, error) {
	assertions, err := r.BalanceAssertions(ctx, booksID, accountID)
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
