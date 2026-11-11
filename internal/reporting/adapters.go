package reporting

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/reporting/app"
)

// priced turns a missing price of either source into app.ErrPriceMissing, so the operation
// answers price_missing.
type priced struct {
	c Commitments
	v Valuations
}

func (p priced) CommittedTotal(ctx context.Context, booksID int64, month time.Time) (money.Money, error) {
	c, err := p.c.CommittedTotal(ctx, booksID, month)
	return c, priceMissing(err)
}

func (p priced) ValuedBalances(ctx context.Context, booksID int64, date time.Time) (map[uuid.UUID]money.Money, error) {
	v, err := p.v.ValuedBalances(ctx, booksID, date)
	return v, priceMissing(err)
}

func priceMissing(err error) error {
	if errors.Is(err, marketdata.ErrPriceMissing) {
		return fmt.Errorf("%w: %w", app.ErrPriceMissing, err)
	}

	return err
}
