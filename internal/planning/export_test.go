package planning

import (
	"context"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// RecurringForTest runs Service.Recurring, which no exported method of the module wraps yet.
func (m *Module) RecurringForTest(
	ctx context.Context,
	booksID int64,
	f app.RecurringFilter,
) ([]domain.Series, error) {
	return m.svc.Recurring(ctx, booksID, f)
}
