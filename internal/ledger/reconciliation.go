// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// UnlinkedPostings lists the account's postings in [from, to] that no external record
// confirms yet and whose transaction is not voided.
func (m *Module) UnlinkedPostings(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from, to time.Time,
) ([]UnlinkedPosting, error) {
	return m.svc.UnlinkedPostings(ctx, booksID, accountID, from, to)
}

// UnconfirmedPostings lists the account's postings that neither a line nor a balance
// confirms, dated by when the institution reports them, in [from, to] (A133).
func (m *Module) UnconfirmedPostings(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from, to time.Time,
) ([]UnlinkedPosting, error) {
	return m.svc.UnconfirmedPostings(ctx, booksID, accountID, from, to)
}

// ConfirmLine corrects a transaction to the amount and date of the statement line matched to
// it on the account (A101).
func (m *Module) ConfirmLine(
	ctx context.Context,
	booksID int64,
	txID, accountID uuid.UUID,
	amount int64,
	date time.Time,
) error {
	return m.svc.ConfirmLine(ctx, booksID, txID, accountID, amount, date)
}

// MoveReconciledDate moves a transaction to its card line's date on a kept statement (P12 A147).
func (m *Module) MoveReconciledDate(
	ctx context.Context,
	booksID int64,
	txID, accountID uuid.UUID,
	date time.Time,
) error {
	return m.svc.MoveReconciledDate(ctx, booksID, txID, accountID, date)
}

// LastBalanceReconciledOn returns the date of the account's latest reconciled balance
// assertion, nil for none (A261).
func (m *Module) LastBalanceReconciledOn(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) (*time.Time, error) {
	return m.svc.LastBalanceReconciledOn(ctx, booksID, accountID)
}

// YieldsSince returns the yields the account's assertions dated from from on booked, each over
// the days since the assertion before it (A264).
func (m *Module) YieldsSince(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from time.Time,
) ([]YieldPeriod, error) {
	return m.svc.YieldsSince(ctx, booksID, accountID, from)
}

// ReserveYieldBound returns the yield D3 can book on settled over the days from from to to on
// the account (A268 RL3).
func (m *Module) ReserveYieldBound(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	settled int64,
	from, to time.Time,
) (int64, error) {
	return m.svc.ReserveYieldBound(ctx, booksID, accountID, settled, from, to)
}

// AccountChecks lists the open balance accounts with their open differences (P12 A152).
func (m *Module) AccountChecks(ctx context.Context, booksID int64) ([]AccountCheck, error) {
	return m.svc.AccountChecks(ctx, booksID)
}

// Counterparts lists the transactions a sync line may pair with (A216 rule 2).
func (m *Module) Counterparts(
	ctx context.Context,
	booksID int64,
	q CounterpartQuery,
) ([]Counterpart, error) {
	return m.svc.Counterparts(ctx, booksID, q)
}

// PairImported makes a transaction the transfer of an imported line on accountID and returns
// its new version; ErrNotPairable when the ledger refuses (A218 rule 1).
func (m *Module) PairImported(
	ctx context.Context,
	booksID int64,
	txID, accountID, recordID uuid.UUID,
) (int, error) {
	return m.svc.PairImported(ctx, booksID, txID, accountID, recordID)
}

// UnpairImported returns a transaction that a pairing left at version to its postings
// before the pairing; ErrNotUnpairable when it changed since or the ledger refuses (A220 rule 2).
func (m *Module) UnpairImported(
	ctx context.Context,
	booksID int64,
	txID, recordID uuid.UUID,
	version int,
) error {
	return m.svc.UnpairImported(ctx, booksID, txID, recordID, version)
}

// ConfirmGroup confirms an entry by the lines of a group: its posting on the account becomes
// one posting per line, each linked to its record (A169).
func (m *Module) ConfirmGroup(
	ctx context.Context,
	booksID int64,
	txID,
	accountID uuid.UUID,
	parts []GroupPart,
) error {
	return m.svc.ConfirmGroup(ctx, booksID, txID, accountID, parts)
}

// GroupableTransactions returns the transactions among txIDs that a group may take over (A167).
func (m *Module) GroupableTransactions(
	ctx context.Context,
	booksID int64,
	txIDs []uuid.UUID) ([]uuid.UUID,
	error,
) {
	return m.svc.GroupableTransactions(ctx, booksID, txIDs)
}
