package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
)

// lastDate bounds deletions that run to the end of a schedule.
var lastDate = time.Date(9999, 12, 31, 0, 0, 0, 0, time.UTC)

// changeOccurrence applies change to an occurrence of the book and returns it as read.
func (s *Service) changeOccurrence(ctx context.Context, booksID int64, id uuid.UUID,
	change func(Repository, domain.Occurrence, domain.Schedule) (domain.Occurrence, error),
) (OccurrenceView, error) {
	var out OccurrenceView
	err := s.repo.InTx(ctx, func(repo Repository) error {
		o, err := repo.LockOccurrence(ctx, booksID, id)
		if err != nil {
			return err
		}

		sch, err := repo.Schedule(ctx, booksID, o.ScheduleID)
		if err != nil {
			return err
		}

		changed, err := change(repo, o, sch)
		if err != nil {
			return err
		}

		out, err = s.view(ctx, booksID, changed, sch)

		return err
	})

	return out, err
}

// Skip skips an expected occurrence (T03).
func (s *Service) Skip(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	reason string,
) (OccurrenceView, error) {
	return s.changeOccurrence(
		ctx,
		booksID,
		id,
		func(repo Repository, _ domain.Occurrence, _ domain.Schedule) (domain.Occurrence, error) {
			return repo.Skip(ctx, booksID, id, reason)
		},
	)
}

// Reopen makes a skipped occurrence expected again, on a date the schedule still produces
// dates on, and lets a transaction already recorded realize it (A200).
func (s *Service) Reopen(ctx context.Context, booksID int64, id uuid.UUID) (OccurrenceView, error) {
	return s.changeOccurrence(
		ctx,
		booksID,
		id,
		func(repo Repository, o domain.Occurrence, sch domain.Schedule) (domain.Occurrence, error) {
			if err := checkReopenable(o, sch); err != nil {
				return domain.Occurrence{}, err
			}

			if _, err := repo.Reopen(ctx, booksID, id); err != nil {
				return domain.Occurrence{}, err
			}

			if err := s.reevaluateAround(ctx, repo, booksID, o, sch); err != nil {
				return domain.Occurrence{}, err
			}

			return repo.LockOccurrence(ctx, booksID, id)
		},
	)
}

// checkReopenable validates that o can become expected again.
func checkReopenable(o domain.Occurrence, sch domain.Schedule) error {
	switch {
	case o.State != domain.Skipped:
		return ErrOccurrenceClosed
	case endsBefore(sch, o.ExpectedOn):
		return ErrScheduleEnded
	case sch.Paused(o.ExpectedOn):
		return &domain.FieldError{
			Field:   "date",
			Message: "falls inside a pause of the schedule",
			Err:     domain.ErrValidation,
		}
	}

	return nil
}

// reevaluateAround lets the transactions recorded around o realize it.
func (s *Service) reevaluateAround(
	ctx context.Context,
	repo Repository,
	booksID int64,
	o domain.Occurrence,
	sch domain.Schedule,
) error {
	ids, err := s.ledger.AccountTransactionsBetween(
		ctx,
		booksID,
		sch.AccountID,
		o.ExpectedOn.AddDate(
			0,
			0,
			-sch.WindowDays,
		),
		o.ExpectedOn.AddDate(0, 0, sch.WindowDays),
	)
	if err != nil {
		return err
	}

	for _, txID := range ids {
		e := TransactionChanged{
			BooksID:       booksID,
			TransactionID: txID,
			AccountIDs:    []uuid.UUID{sch.AccountID},
		}
		if err := s.reevaluate(ctx, repo, e); err != nil {
			return err
		}
	}

	return nil
}

// Move moves an expected occurrence; it keeps its sequence and is never regenerated (A52).
// The new date is one the schedule produces dates on: outside its pauses and before its end.
func (s *Service) Move(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	date time.Time,
) (OccurrenceView, error) {
	return s.changeOccurrence(
		ctx,
		booksID,
		id,
		func(repo Repository, o domain.Occurrence, sch domain.Schedule) (domain.Occurrence, error) {
			switch {
			case o.State != domain.Expected:
				return domain.Occurrence{}, ErrOccurrenceClosed
			case endsBefore(sch, date):
				return domain.Occurrence{}, ErrScheduleEnded
			case sch.Paused(date):
				return domain.Occurrence{}, &domain.FieldError{
					Field:   "date",
					Message: "falls inside a pause of the schedule",
					Err:     domain.ErrValidation,
				}
			}

			return repo.Move(ctx, booksID, id, date)
		},
	)
}

// changeSchedule runs change on the locked schedule and returns the schedule as stored after it.
func (s *Service) changeSchedule(ctx context.Context, booksID int64, id uuid.UUID,
	change func(Repository, *domain.Schedule) error,
) (domain.Schedule, error) {
	var out domain.Schedule
	err := s.repo.InTx(ctx, func(repo Repository) error {
		sch, err := repo.LockSchedule(ctx, booksID, id)
		if err != nil {
			return err
		}

		if err := change(repo, &sch); err != nil {
			return err
		}

		out, err = repo.Schedule(ctx, booksID, id)

		return err
	})

	return out, err
}

func endsBefore(sch domain.Schedule, d time.Time) bool {
	return sch.EndsOn != nil && !d.Before(*sch.EndsOn)
}

// Pause suppresses the dates in [from, to]; its expected occurrences, moved ones included, go.
func (s *Service) Pause(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	from, to time.Time,
) (domain.Schedule, error) {
	return s.changeSchedule(ctx, booksID, id, func(repo Repository, sch *domain.Schedule) error {
		if to.Before(from) {
			return &domain.FieldError{
				Field:   "to",
				Message: "must not be before from",
				Err:     domain.ErrValidation,
			}
		}

		if endsBefore(*sch, from) {
			return ErrScheduleEnded
		}

		if err := repo.InsertPause(
			ctx,
			booksID,
			sch.ID,
			domain.Pause{From: from, To: to},
		); err != nil {
			return err
		}

		_, err := repo.DeleteExpected(ctx, booksID, sch.ID, from, to, true)

		return err
	})
}

// End produces no occurrence on or after from; expected ones go, realized and skipped stay.
func (s *Service) End(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	from time.Time,
) (domain.Schedule, error) {
	return s.changeSchedule(ctx, booksID, id, func(repo Repository, sch *domain.Schedule) error {
		if endsBefore(*sch, from) {
			return ErrScheduleEnded
		}

		if err := repo.SetEndsOn(ctx, booksID, sch.ID, from); err != nil {
			return err
		}

		_, err := repo.DeleteExpected(ctx, booksID, sch.ID, from, lastDate, true)

		return err
	})
}
