// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// AccountTransactionsBetween returns the book's non-voided transactions with a posting on the
// account dated in [from, to], by date.
func (m *Module) AccountTransactionsBetween(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from, to time.Time,
) ([]uuid.UUID, error) {
	return m.svc.AccountTransactionsBetween(ctx, booksID, accountID, from, to)
}

// TransactionFacts returns the facts of the book's transactions among ids in the order of
// ids; unknown ids are omitted.
func (m *Module) TransactionFacts(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
) ([]TransactionFacts, error) {
	return m.svc.TransactionFacts(ctx, booksID, ids)
}

// ExternalFlows is the money that entered (positive) or left (negative) the accounts and their
// sub-accounts, taken as one tree, between from and to, one item per transaction, in its
// balancing currency.
func (m *Module) ExternalFlows(
	ctx context.Context,
	booksID int64,
	accountIDs []uuid.UUID,
	from, to time.Time,
) ([]ExternalFlow, error) {
	return m.svc.ExternalFlows(ctx, booksID, accountIDs, from, to)
}

// RecordedYield reads what the ledger records of the accounts and their sub-accounts in [from, to]:
// the flows that are not yield, the yield credits and the other income and expense amounts.
func (m *Module) RecordedYield(
	ctx context.Context,
	booksID int64,
	accountIDs []uuid.UUID,
	from, to time.Time,
) (RecordedYield, error) {
	return m.svc.RecordedYield(ctx, booksID, accountIDs, from, to)
}

// FirstPosting is the booked date of the earliest posting of the accounts and their sub-accounts;
// false when they have none.
func (m *Module) FirstPosting(
	ctx context.Context,
	booksID int64,
	accountIDs []uuid.UUID,
) (time.Time, bool, error) {
	return m.svc.FirstPosting(ctx, booksID, accountIDs)
}

// InvestmentFacts returns the facts Portfolio derives from: the children of brokerageID
// that hold a security, their postings, trades and income (P8 amendment A71).
func (m *Module) InvestmentFacts(
	ctx context.Context,
	booksID int64,
	brokerageID uuid.UUID,
) (InvestmentFacts, error) {
	return m.svc.InvestmentFacts(ctx, booksID, brokerageID)
}

// BaseCurrency returns the book's base currency, as GET /settings reads it.
func (m *Module) BaseCurrency(ctx context.Context, booksID int64) (money.Currency, error) {
	s, err := m.svc.Settings(ctx, booksID)
	return s.BaseCurrency, err
}

// CaptureVocabulary returns the balance accounts and the live payees a capture reads against.
func (m *Module) CaptureVocabulary(
	ctx context.Context,
	booksID int64,
) ([]CaptureAccount, []CapturePayee, error) {
	return m.svc.CaptureVocabulary(ctx, booksID)
}

func (m *Module) AccountFacts(ctx context.Context, booksID int64) ([]AccountFact, error) {
	return m.svc.AccountFacts(ctx, booksID)
}

// MissingPayees returns the ids that are not payees of the book.
func (m *Module) MissingPayees(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
) ([]uuid.UUID, error) {
	return m.svc.MissingPayees(ctx, booksID, ids)
}
