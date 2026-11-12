package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// reconciliationStore holds the Repository methods of balance assertions and reconciliation.
type reconciliationStore interface {
	LockAccount(ctx context.Context, booksID int64, id uuid.UUID) (domain.Account, error)
	InsertBalanceAssertion(ctx context.Context, a BalanceAssertion) (BalanceAssertion, error)
	BalanceAssertion(ctx context.Context, booksID int64, id uuid.UUID) (BalanceAssertion, error)
	// BalanceAssertions returns the account's assertions, latest date first.
	BalanceAssertions(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
	) ([]BalanceAssertion, error)
	BalanceAssertionPage(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		p page.Request[AssertionKey],
	) ([]BalanceAssertion, *AssertionKey, error)
	LastReconciledOn(ctx context.Context, booksID int64, accountID uuid.UUID) (*time.Time, error)
	FirstSettledOn(ctx context.Context, booksID int64, accountID uuid.UUID) (*time.Time, error)
	// InsertReconciliation returns domain.ErrAlreadyReconciled for an assertion or statement reconciled before.
	InsertReconciliation(ctx context.Context, rec Reconciliation) error
	// ReconcilePostings marks the account's non-voided postings settled through the date as reconciled.
	ReconcilePostings(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		through time.Time,
	) error
	ReconcileStatementPostings(ctx context.Context, booksID int64, statementID uuid.UUID) error
	// UnlockAccount returns reconciled postings settled from the date to cleared and deletes
	// the reconciliations dated from it.
	UnlockAccount(ctx context.Context, booksID int64, accountID uuid.UUID, from time.Time) error
}
