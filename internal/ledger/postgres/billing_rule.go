package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

func (r *Repository) SaveBillingRule(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	rule domain.BillingCycleRule,
) (domain.BillingCycleRule, error) {
	p := SaveBillingRuleParams{
		BooksID:       booksID,
		AccountID:     accountID,
		EffectiveFrom: rule.EffectiveFrom.FirstDay(),
		//nolint:gosec // days are 1 to 31 (domain.NewBillingCycleRule).
		DueDay:               int16(rule.DueDay),
		ClosingDayAssignment: rule.Assignment,
		DueDateAdjustment:    rule.Adjustment,
		Calendar:             rule.Calendar,
		ClosingMode:          rule.ClosingMode,
		ClosingAdjustment:    rule.ClosingAdjustment,
	}
	if rule.ClosingMode == domain.ClosingBeforeDue {
		//nolint:gosec // 1 to 28 (domain.NewBillingCycleRule).
		days := int16(rule.ClosingDaysBeforeDue)
		p.ClosingDaysBeforeDue = &days
	} else {
		//nolint:gosec // days are 1 to 31 (domain.NewBillingCycleRule).
		day := int16(rule.ClosingDay)
		p.ClosingDay = &day
	}

	row, err := r.q.SaveBillingRule(ctx, p)
	if err != nil {
		return domain.BillingCycleRule{}, err
	}

	return toBillingRule(row), nil
}

func (r *Repository) BillingRules(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) (domain.Rules, error) {
	rows, err := r.q.ListBillingRules(
		ctx,
		ListBillingRulesParams{BooksID: booksID, AccountID: accountID},
	)

	return mapAll(rows, toBillingRule), err
}
