// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"

	"github.com/google/uuid"
)

// Categorize applies each item in one database transaction; errs[i] is the domain error of
// item i (ErrNotFound, ErrVersionConflict, ErrNotCategorizable, ErrVoided, ErrValidation).
func (m *Module) Categorize(ctx context.Context, booksID int64, cs []Categorization) (errs []error, err error) {
	return m.svc.Categorize(ctx, booksID, cs)
}

// LatestPayeeCategories implements the payee history of P5 amendment A23.
func (m *Module) LatestPayeeCategories(ctx context.Context, booksID int64, payees []uuid.UUID) (map[PayeeClass]uuid.UUID, error) {
	return m.svc.LatestPayeeCategories(ctx, booksID, payees)
}

// Transfer replaces the category side of a transaction with a posting on another account,
// pairing it with the imported other side when one exists.
func (m *Module) Transfer(ctx context.Context, booksID int64, r TransferRequest) (TransferResult, error) {
	return m.svc.Transfer(ctx, booksID, r)
}
