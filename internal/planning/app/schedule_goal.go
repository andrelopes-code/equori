package app

import (
	"context"
	"errors"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// checkScheduleGoal checks that the goal of the schedule, when set, holds its counterpart by
// allocations and that the schedule moves money between accounts (planning coherence A255).
func (s *Service) checkScheduleGoal(ctx context.Context, booksID int64, sch domain.Schedule) error {
	if sch.GoalID == uuid.Nil {
		return nil
	}

	invalid := &domain.FieldError{
		Field:   "goal_id",
		Message: "must be a goal that holds counterpart_id by allocations, on a savings or transfer schedule",
		Err:     domain.ErrValidation,
	}

	g, err := s.repo.Goal(ctx, booksID, sch.GoalID)
	if errors.Is(err, ErrNotFound) {
		return invalid
	}

	if err != nil {
		return err
	}

	if !movesMoney(sch.Kind) || !slices.Contains(g.AllocatedAccountIDs, sch.CounterpartID) {
		return invalid
	}

	return nil
}
