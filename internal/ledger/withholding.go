package ledger

import (
	"context"
	"time"

	"github.com/google/uuid"
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
