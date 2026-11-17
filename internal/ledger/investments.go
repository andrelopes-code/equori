package ledger

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Orders and results of the investments another module records (A236 FC28).
type (
	FixedIncomeApplication = app.FixedIncomeApplication
	FixedIncomeResult      = app.FixedIncomeResult
	Contract               = app.Contract
	TradeOrder             = domain.TradeOrder
	IncomeOrder            = domain.IncomeOrder
	Transaction            = domain.Transaction
	// FieldError names the field a rule refused.
	FieldError = domain.FieldError
)

const (
	SideSell       = domain.SideSell
	IncomeInterest = domain.IncomeInterest
)

// Refusals of a fixed income application.
var (
	ErrContractInvalid        = app.ErrContractInvalid
	ErrBrokerageCashMissing   = app.ErrBrokerageCashMissing
	ErrBrokerageCashAmbiguous = app.ErrBrokerageCashAmbiguous
)

func (m *Module) ApplyFixedIncome(
	ctx context.Context,
	booksID int64,
	a FixedIncomeApplication,
) (FixedIncomeResult, error) {
	return m.svc.ApplyFixedIncome(ctx, booksID, a)
}

func (m *Module) RecordTrade(
	ctx context.Context,
	booksID int64,
	o TradeOrder,
) (Transaction, error) {
	return m.svc.RecordTrade(ctx, booksID, o)
}

func (m *Module) RecordIncome(
	ctx context.Context,
	booksID int64,
	o IncomeOrder,
) (Transaction, error) {
	return m.svc.RecordIncome(ctx, booksID, o)
}

func (m *Module) VoidTransaction(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	reason string,
) error {
	return m.svc.VoidTransaction(ctx, booksID, id, reason)
}

func (m *Module) Transaction(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (Transaction, error) {
	return m.svc.Transaction(ctx, booksID, id)
}

// FixedIncomeUnitPrice is the unit price a contribution to the contract reads on a date.
func (m *Module) FixedIncomeUnitPrice(
	ctx context.Context,
	booksID int64,
	instrument money.Currency,
	on time.Time,
) (money.Rate, error) {
	return m.svc.FixedIncomeUnitPrice(ctx, booksID, instrument, on)
}
