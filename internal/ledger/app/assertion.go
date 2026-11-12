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
