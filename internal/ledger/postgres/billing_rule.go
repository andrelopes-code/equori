package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

func (r *Repository) InsertBillingRule(ctx context.Context, booksID int64, accountID uuid.UUID, rule domain.BillingCycleRule) (domain.BillingCycleRule, error) {
	p := InsertBillingRuleParams{
		BooksID: booksID, AccountID: accountID, EffectiveFrom: rule.EffectiveFrom.FirstDay(),
		DueDay:               int16(rule.DueDay), //nolint:gosec // days are 1 to 31 (domain.NewBillingCycleRule).
		ClosingDayAssignment: rule.Assignment, DueDateAdjustment: rule.Adjustment, Calendar: rule.Calendar,
		ClosingMode: rule.ClosingMode, ClosingAdjustment: rule.ClosingAdjustment,
	}
	if rule.ClosingMode == domain.ClosingBeforeDue {
		days := int16(rule.ClosingDaysBeforeDue) //nolint:gosec // 1 to 28 (domain.NewBillingCycleRule).
		p.ClosingDaysBeforeDue = &days
	} else {
		day := int16(rule.ClosingDay) //nolint:gosec // days are 1 to 31 (domain.NewBillingCycleRule).
		p.ClosingDay = &day
	}

	row, err := r.q.InsertBillingRule(ctx, p)
	if err != nil {
		return domain.BillingCycleRule{}, duplicate(err, "effective_from")
	}

	return toBillingRule(row), nil
}

func (r *Repository) BillingRules(ctx context.Context, booksID int64, accountID uuid.UUID) (domain.Rules, error) {
	rows, err := r.q.ListBillingRules(ctx, ListBillingRulesParams{BooksID: booksID, AccountID: accountID})
	return mapAll(rows, toBillingRule), err
}
