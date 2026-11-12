// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// RecordImported creates the transaction of an external record; it is idempotent by recordID
// (P4 amendments A11, A14).
func (m *Module) RecordImported(
	ctx context.Context,
	booksID int64,
	recordID uuid.UUID,
	p ImportedPosting,
) (uuid.UUID, error) {
	return m.svc.RecordImported(ctx, booksID, recordID, p)
}

// ImportTarget returns the currency and kind of an account that can hold statement lines;
// an account that cannot is an ErrValidation.
func (m *Module) ImportTarget(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) (ImportTarget, error) {
	return m.svc.ImportTarget(ctx, booksID, accountID)
}

// LinkedTransaction returns the transaction carrying an external record and whether the
// import created it; ErrNotFound when none carries it.
func (m *Module) LinkedTransaction(
	ctx context.Context,
	booksID int64,
	recordID uuid.UUID,
) (uuid.UUID, bool, error) {
	return m.svc.LinkedTransaction(ctx, booksID, recordID)
}

// RecordImportedBatch creates the transactions of many external records in one database
// transaction; ids follow the input order and a rejected line is a *LineError.
func (m *Module) RecordImportedBatch(
	ctx context.Context,
	booksID int64,
	recs []ImportedRecord,
) ([]uuid.UUID, error) {
	return m.svc.RecordImportedBatch(ctx, booksID, recs)
}

// ClearMatchedBatch links records to transactions in one database transaction and returns
// the indexes of the matches whose transaction meanwhile carries another record.
func (m *Module) ClearMatchedBatch(ctx context.Context, booksID int64, ms []Match) ([]int, error) {
	return m.svc.ClearMatchedBatch(ctx, booksID, ms)
}

// ClearMatched links an external record to a transaction and clears its pending postings.
func (m *Module) ClearMatched(
	ctx context.Context,
	booksID int64,
	recordID, txID, accountID uuid.UUID,
) error {
	return m.svc.ClearMatched(ctx, booksID, recordID, txID, accountID)
}

// AssertBalance records a balance reported by an imported file (source import, F6).
func (m *Module) AssertBalance(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	amount money.Money,
) error {
	_, err := m.svc.AssertBalance(ctx, booksID, accountID, date, amount, app.SourceImport)
	return err
}

// AssertSyncedBalance records an aggregator's balance, or decides the open assertion of the
// same date and amount again; it never records yield (P6 A42, A77).
func (m *Module) AssertSyncedBalance(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	amount money.Money,
) error {
	_, err := m.svc.AssertSynced(ctx, booksID, accountID, date, amount, false)
	return err
}

// AssertSyncedReserve is AssertSyncedBalance for a reserved balance: a positive difference
// within the yield bound of an account with automatic yield is booked as yield (A75).
func (m *Module) AssertSyncedReserve(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	amount money.Money,
) error {
	_, err := m.svc.AssertSynced(ctx, booksID, accountID, date, amount, true)
	return err
}

// UpdateImportedPosting applies an aggregator's later report on a recorded line (P6 A36);
// a reconciled posting that already holds the report is (false, nil), another is ErrReconciled.
func (m *Module) UpdateImportedPosting(
	ctx context.Context,
	booksID int64,
	recordID uuid.UUID,
	u ImportedUpdate,
) (bool, error) {
	return m.svc.UpdateImportedPosting(ctx, booksID, recordID, u)
}

// RecordImportedInstallment creates the installment purchase of an aggregator line (P6 A40).
func (m *Module) RecordImportedInstallment(
	ctx context.Context,
	booksID int64,
	in ImportedInstallment,
) (txID, planID uuid.UUID, err error) {
	return m.svc.RecordImportedInstallment(ctx, booksID, in)
}

// LinkInstallment links an aggregator line to installment number of a plan (P6 A40).
func (m *Module) LinkInstallment(
	ctx context.Context,
	booksID int64,
	recordID, planID uuid.UUID,
	number int,
	c InstallmentConfirmation,
) (uuid.UUID, error) {
	return m.svc.LinkInstallment(ctx, booksID, recordID, planID, number, c)
}

// ReleaseRecord unlinks a withdrawn record from its posting (P6 A38).
func (m *Module) ReleaseRecord(ctx context.Context, booksID int64, recordID uuid.UUID) error {
	return m.svc.ReleaseRecord(ctx, booksID, recordID)
}
