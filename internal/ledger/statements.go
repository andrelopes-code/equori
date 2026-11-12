// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// RecordStatementFacts records an aggregator's bill on the card statement it is due on (A85, A86).
func (m *Module) RecordStatementFacts(
	ctx context.Context,
	booksID int64,
	cardID uuid.UUID,
	f StatementFacts,
) error {
	return m.svc.RecordStatementFacts(ctx, booksID, cardID, f)
}

// RecordCardOpening opens a card without an opening balance with a bill's total (A93).
func (m *Module) RecordCardOpening(
	ctx context.Context,
	booksID int64,
	cardID uuid.UUID,
	due time.Time,
	total money.Money,
) error {
	return m.svc.RecordCardOpening(ctx, booksID, cardID, due, total)
}

// SettleReportedStatements moves pending card postings off reported statements and
// reconciles the reported statements that match (A90, A92).
func (m *Module) SettleReportedStatements(
	ctx context.Context,
	booksID int64,
	cardID uuid.UUID,
) error {
	return m.svc.SettleReportedStatements(ctx, booksID, cardID)
}
