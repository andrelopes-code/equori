package postgres

import (
	"time"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func toSchedule(row PlanningSchedule) domain.Schedule {
	return domain.Schedule{
		ID:            row.ID,
		Kind:          domain.Kind(row.Kind),
		AccountID:     row.AccountID,
		CounterpartID: row.CounterpartID,
		PayeeID:       row.PayeeID.UUID,
		Description:   row.Description,
		Currency:      money.Currency(row.Currency),
		ToleranceBP: int(
			row.MatchToleranceBp,
		),
		GraceDays:      int(row.GraceDays),
		WindowDays:     int(row.MatchWindowDays),
		Calendar:       row.Calendar,
		EndsOn:         row.EndsOn,
		GeneratedUntil: row.GeneratedUntil,
		CreatedAt:      row.CreatedAt,
	}
}

func toTerms(row PlanningScheduleTerm) domain.Terms {
	rule := domain.Rule{
		Frequency: domain.Frequency(
			row.Frequency,
		),
		Interval:   int(row.Interval),
		DayOfMonth: fromPtr(row.DayOfMonth),
		Ordinal: fromPtr(
			row.Ordinal,
		),
		BusinessDayOrdinal: fromPtr(row.BusinessDayOrdinal),
		Adjustment:         row.Adjustment,
		Start:              row.Start,
		Until:              row.Until,
		Count:              fromPtr(row.Count),
	}
	if row.Weekday != nil {
		w := time.Weekday(*row.Weekday)
		rule.Weekday = &w
	}

	return domain.Terms{
		EffectiveFrom: row.EffectiveFrom,
		Rule:          rule,
		Amount:        row.Amount,
		FirstSequence: fromPtr(row.FirstSequence),
	}
}
