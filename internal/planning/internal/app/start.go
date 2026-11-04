package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
)

// moveStart makes the schedule start on startsOn, a date before its first one (A198). The rule
// keeps its rhythm: the dates it already produced stay, with their occurrences, and take the
// next sequences; the dates it gains before them are inserted. A gained date is expected while
// it is not overdue and skipped after that, unless a recorded transaction realizes it.
func (s *Service) moveStart(ctx context.Context, repo Repository, booksID int64, sch domain.Schedule, startsOn time.Time) error {
	first := sch.Terms[0]
	if !startsOn.Before(first.Rule.Start) {
		return startError("must be before the current start")
	}

	rule := first.Rule
	rule.Start = startsOn

	if rule.Count != 0 {
		return startError("cannot move earlier a recurrence that has a count")
	}

	days, err := s.days(ctx, sch.Calendar, startsOn, first.Rule.Start.AddDate(first.Rule.Interval+1, 0, 0))
	if err != nil {
		return err
	}

	firstDates := first.Rule.Dates(time.Time{}, first.Rule.Start.AddDate(first.Rule.Interval+1, 0, 0), days)
	if len(firstDates) == 0 {
		return startError("the schedule has no date to start before")
	}

	shift := -1

	for i, d := range rule.Dates(time.Time{}, firstDates[0].Date, days) {
		if d.Date.Equal(firstDates[0].Date) {
			shift = i
		}
	}

	if shift < 0 {
		return startError("is not on the rhythm of the recurrence")
	}

	if err := repo.MoveScheduleStart(ctx, booksID, sch.ID, first.EffectiveFrom, startsOn, shift); err != nil {
		return err
	}

	moved, err := repo.Schedule(ctx, booksID, sch.ID)
	if err != nil {
		return err
	}

	keepFrom := s.clk.Today(ctx).AddDate(0, 0, -moved.GraceDays)

	return s.fill(ctx, repo, booksID, moved, startsOn, firstDates[0].Date.AddDate(0, 0, -1), keepFrom, uuid.Nil)
}

func startError(message string) error {
	return &domain.FieldError{Field: "starts_on", Message: message, Err: domain.ErrValidation}
}
