package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// moveStart makes the schedule start on startsOn, a date before its first one (A198). The rule
// keeps its rhythm: the dates it already produced stay, with their occurrences, and take the
// next sequences; the dates it gains before them are inserted. A gained date is expected while
// it is not overdue and skipped after that, unless a recorded transaction realizes it.
func (s *Service) moveStart(
	ctx context.Context,
	repo Repository,
	booksID int64,
	sch domain.Schedule,
	startsOn time.Time,
) error {
	first := sch.Terms[0]
	if !startsOn.Before(first.Rule.Start) {
		return startError("must be before the current start")
	}

	shift, firstDate, err := s.startShift(ctx, sch, startsOn)
	if err != nil {
		return err
	}

	if err := repo.MoveScheduleStart(
		ctx,
		booksID,
		sch.ID,
		first.EffectiveFrom,
		startsOn,
		shift,
	); err != nil {
		return err
	}

	moved, err := repo.Schedule(ctx, booksID, sch.ID)
	if err != nil {
		return err
	}

	keepFrom := s.clk.Today(ctx).AddDate(0, 0, -moved.GraceDays)

	return s.fill(
		ctx,
		repo,
		booksID,
		moved,
		startsOn,
		firstDate.AddDate(0, 0, -1),
		keepFrom,
		uuid.Nil,
	)
}

// startShift returns the number of dates the rhythm of the rule gains before its first date, and
// that first date, for a start on startsOn.
func (s *Service) startShift(
	ctx context.Context,
	sch domain.Schedule,
	startsOn time.Time,
) (int, time.Time, error) {
	first := sch.Terms[0]
	rule := first.Rule
	rule.Start = startsOn

	if rule.Count != 0 {
		return 0, time.Time{}, startError("cannot move earlier a recurrence that has a count")
	}

	days, err := s.days(
		ctx,
		sch.Calendar,
		startsOn,
		first.Rule.Start.AddDate(first.Rule.Interval+1, 0, 0),
	)
	if err != nil {
		return 0, time.Time{}, err
	}

	firstDates := first.Rule.Dates(
		time.Time{},
		first.Rule.Start.AddDate(first.Rule.Interval+1, 0, 0),
		days,
	)
	if len(firstDates) == 0 {
		return 0, time.Time{}, startError("the schedule has no date to start before")
	}

	shift := -1

	for i, d := range rule.Dates(time.Time{}, firstDates[0].Date, days) {
		if d.Date.Equal(firstDates[0].Date) {
			shift = i
		}
	}

	if shift < 0 {
		return 0, time.Time{}, startError("is not on the rhythm of the recurrence")
	}

	return shift, firstDates[0].Date, nil
}

func startError(message string) error {
	return &domain.FieldError{Field: "starts_on", Message: message, Err: domain.ErrValidation}
}
