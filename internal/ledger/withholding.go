package ledger

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// EstimateWithholding is the tax a sale of units of the security for proceedsMinor would withhold
// on date (A235 FS4); a validation error means the account has no withholding table.
func (m *Module) EstimateWithholding(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	units, proceedsMinor int64,
) (WithholdingEstimate, error) {
	return m.svc.EstimateWithholding(ctx, booksID, accountID, date, units, proceedsMinor)
}

// ReceiptCustodyFee is the custody fee a receipt of amount of instrument on date pays; nil when it
// pays none by receipt.
func (m *Module) ReceiptCustodyFee(
	ctx context.Context,
	booksID int64,
	instrument money.Currency,
	amount money.Money,
	date time.Time,
) (*money.Money, error) {
	return m.svc.ReceiptCustodyFee(ctx, booksID, instrument, amount, date)
}
