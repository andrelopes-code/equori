package ingestion

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (p ledgerPort) AssertBalance(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	b domain.Balance,
	c money.Currency,
) error {
	return p.assert(ctx, booksID, accountID, b, c, p.l.AssertBalance)
}

func (p ledgerPort) AssertSyncedBalance(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	b domain.Balance,
	c money.Currency,
) error {
	return p.assert(ctx, booksID, accountID, b, c, p.l.AssertSyncedBalance)
}

func (p ledgerPort) AssertSyncedReserve(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	b domain.Balance,
	c money.Currency,
) error {
	return p.assert(ctx, booksID, accountID, b, c, p.l.AssertSyncedReserve)
}

func (p ledgerPort) LastBalanceReconciledOn(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) (*time.Time, error) {
	on, err := p.l.LastBalanceReconciledOn(ctx, booksID, accountID)

	return on, p.translate(err)
}

type assertFunc func(ctx context.Context, booksID int64, accountID uuid.UUID, date time.Time, amount money.Money) error

func (p ledgerPort) assert(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	b domain.Balance,
	c money.Currency,
	assert assertFunc,
) error {
	amount, err := money.New(b.Amount, c)
	if err != nil {
		return err
	}

	err = assert(ctx, booksID, accountID, b.Date, amount)
	if errors.Is(err, ledger.ErrAlreadyReconciled) || errors.Is(err, ledger.ErrValidation) {
		return fmt.Errorf("%w: %w", app.ErrBalanceRejected, err)
	}

	return p.translate(err)
}
