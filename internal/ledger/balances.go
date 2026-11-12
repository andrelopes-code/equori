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

// Balance returns the booked balance of an account at the end of date, as GET
// /accounts/{id}/balance reads it.
func (m *Module) Balance(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
) (money.Money, error) {
	b, err := m.svc.BalanceAt(ctx, booksID, accountID, date, app.BasisBooked)
	return b.Amount, err
}

// ValuedBalance is the booked balance of an account and its sub-accounts at the end of date,
// each instrument valued in currency in with stored prices (P8 amendment A65).
func (m *Module) ValuedBalance(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	in money.Currency,
) (Conversion, error) {
	_, c, err := m.svc.ValuedBalance(ctx, booksID, accountID, date, app.BasisBooked, in)
	return c, err
}

// Balances is the booked balance of every asset and liability account at the end of date, each
// in the instrument of the account and counting its own postings only (P1, B2).
func (m *Module) Balances(
	ctx context.Context,
	booksID int64,
	date time.Time,
) ([]AccountBalance, error) {
	return m.svc.BalancesAt(ctx, booksID, date, app.BasisBooked)
}
