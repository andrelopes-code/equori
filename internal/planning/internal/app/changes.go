package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// lastDate bounds deletions that run to the end of a schedule.
var lastDate = time.Date(9999, 12, 31, 0, 0, 0, 0, time.UTC)

// changeOccurrence applies change to an occurrence of the user and returns it as read.
func (s *Service) changeOccurrence(ctx context.Context, userID int64, id uuid.UUID,
	change func(Repository, domain.Occurrence, domain.Schedule) (domain.Occurrence, error),
) (OccurrenceView, error) {
	var out OccurrenceView
	err := s.repo.InTx(ctx, func(repo Repository) error {
		o, err := repo.LockOccurrence(ctx, userID, id)
		if err != nil {
			return err
		}
		sch, err := repo.Schedule(ctx, userID, o.ScheduleID)
		if err != nil {
			return err
		}
		changed, err := change(repo, o, sch)
		out = s.view(changed, sch)
		return err
	})
	return out, err
}

// Skip skips an expected occurrence (T03).
func (s *Service) Skip(ctx context.Context, userID int64, id uuid.UUID, reason string) (OccurrenceView, error) {
	return s.changeOccurrence(ctx, userID, id, func(repo Repository, _ domain.Occurrence, _ domain.Schedule) (domain.Occurrence, error) {
		return repo.Skip(ctx, userID, id, reason)
	})
}

// Move moves an expected occurrence; it keeps its sequence and is never regenerated (A52).
// The new date is one the schedule produces dates on: outside its pauses and before its end.
func (s *Service) Move(ctx context.Context, userID int64, id uuid.UUID, date time.Time) (OccurrenceView, error) {
	return s.changeOccurrence(ctx, userID, id, func(repo Repository, o domain.Occurrence, sch domain.Schedule) (domain.Occurrence, error) {
		switch {
		case o.State != domain.Expected:
			return domain.Occurrence{}, ErrOccurrenceClosed
		case endsBefore(sch, date):
			return domain.Occurrence{}, ErrScheduleEnded
		case sch.Paused(date):
			return domain.Occurrence{}, &domain.FieldError{Field: "date", Message: "falls inside a pause of the schedule", Err: domain.ErrValidation}
		}
		return repo.Move(ctx, userID, id, date)
	})
}

// changeSchedule runs change on the locked schedule and returns the schedule as stored after it.
func (s *Service) changeSchedule(ctx context.Context, userID int64, id uuid.UUID,
	change func(Repository, *domain.Schedule) error,
) (domain.Schedule, error) {
	var out domain.Schedule
	err := s.repo.InTx(ctx, func(repo Repository) error {
		sch, err := repo.LockSchedule(ctx, userID, id)
		if err != nil {
			return err
		}
		if err := change(repo, &sch); err != nil {
			return err
		}
		out, err = repo.Schedule(ctx, userID, id)
		return err
	})
	return out, err
}

func endsBefore(sch domain.Schedule, d time.Time) bool {
	return sch.EndsOn != nil && !d.Before(*sch.EndsOn)
}

// ChangeTerms adds a terms version from effectiveFrom; without rule the previous rule is kept,
// start included (A49). Expected occurrences from that date on that were not moved are
// regenerated (A52).
func (s *Service) ChangeTerms(ctx context.Context, userID int64, id uuid.UUID, effectiveFrom time.Time, amount *money.Money, rule *domain.Rule) (domain.Schedule, error) {
	return s.changeSchedule(ctx, userID, id, func(repo Repository, sch *domain.Schedule) error {
		if endsBefore(*sch, effectiveFrom) {
			return ErrScheduleEnded
		}
		last := sch.Terms[len(sch.Terms)-1]
		if !effectiveFrom.After(last.EffectiveFrom) {
			return &domain.FieldError{Field: "effective_from", Message: "must be after the latest terms version", Err: domain.ErrValidation}
		}
		if amount == nil && rule == nil {
			return &domain.FieldError{Field: "amount", Message: "amount or recurrence is required", Err: domain.ErrValidation}
		}
		next := domain.Terms{EffectiveFrom: effectiveFrom, Rule: last.Rule, Amount: last.Amount}
		if amount != nil {
			if amount.Currency() != sch.Currency {
				return &domain.FieldError{Field: "amount.currency", Message: "must be the schedule currency " + string(sch.Currency), Err: domain.ErrValidation}
			}
			next.Amount = amount.Amount()
		}
		if rule != nil {
			next.Rule = *rule
			if next.Rule.Adjustment == "" {
				next.Rule.Adjustment = "none"
			}
		}
		sch.Terms = append(sch.Terms, next)
		if err := sch.Validate(); err != nil {
			return err
		}
		first, err := s.firstSequence(ctx, repo, userID, *sch)
		if err != nil {
			return err
		}
		sch.Terms[len(sch.Terms)-1].FirstSequence = first
		if err := repo.InsertTerms(ctx, userID, sch.ID, sch.Terms[len(sch.Terms)-1]); err != nil {
			return err
		}
		removed, err := repo.DeleteExpected(ctx, userID, sch.ID, effectiveFrom, lastDate, false)
		if err != nil {
			return err
		}
		// Regenerate only where occurrences existed: from today, or from the earliest date
		// removed when it is earlier, never before the effective date.
		from := s.clk.Today()
		for _, d := range removed {
			if d.Before(from) {
				from = d
			}
		}
		if from.Before(effectiveFrom) {
			from = effectiveFrom
		}
		return s.regenerate(ctx, repo, userID, *sch, from)
	})
}

// firstSequence returns the first sequence of the latest terms version of sch: 0 to continue
// after the earlier versions, unless a kept occurrence holds one of the sequences the version
// would take for another date; then the version starts after the highest kept sequence.
func (s *Service) firstSequence(ctx context.Context, repo Repository, userID int64, sch domain.Schedule) (int, error) {
	latest := sch.Terms[len(sch.Terms)-1]
	kept, err := repo.KeptOccurrences(ctx, userID, sch.ID, latest.EffectiveFrom)
	if err != nil || len(kept) == 0 {
		return 0, err
	}
	until := sch.GeneratedUntil
	for _, o := range kept {
		if g := generated(o); g.After(until) {
			until = g
		}
	}
	days, err := s.days(ctx, sch.Calendar, sch.Terms[0].Rule.Start, until)
	if err != nil {
		return 0, err
	}
	dates := map[int]time.Time{}
	for _, p := range sch.Planned(latest.EffectiveFrom, until, days) {
		dates[p.Sequence] = p.Date
	}
	highest, covered := 0, true
	for _, o := range kept {
		highest = max(highest, o.Sequence)
		if d, ok := dates[o.Sequence]; ok && !d.Equal(generated(o)) {
			covered = false
		}
	}
	if covered {
		return 0, nil
	}
	return highest + 1, nil
}

// generated is the date the schedule produced for o, before any move.
func generated(o domain.Occurrence) time.Time {
	if o.MovedFrom != nil {
		return *o.MovedFrom
	}
	return o.ExpectedOn
}

// Pause suppresses the dates in [from, to]; its expected occurrences, moved ones included, go.
func (s *Service) Pause(ctx context.Context, userID int64, id uuid.UUID, from, to time.Time) (domain.Schedule, error) {
	return s.changeSchedule(ctx, userID, id, func(repo Repository, sch *domain.Schedule) error {
		if to.Before(from) {
			return &domain.FieldError{Field: "to", Message: "must not be before from", Err: domain.ErrValidation}
		}
		if endsBefore(*sch, from) {
			return ErrScheduleEnded
		}
		if err := repo.InsertPause(ctx, userID, sch.ID, domain.Pause{From: from, To: to}); err != nil {
			return err
		}
		_, err := repo.DeleteExpected(ctx, userID, sch.ID, from, to, true)
		return err
	})
}

// End produces no occurrence on or after from; expected ones go, realized and skipped stay.
func (s *Service) End(ctx context.Context, userID int64, id uuid.UUID, from time.Time) (domain.Schedule, error) {
	return s.changeSchedule(ctx, userID, id, func(repo Repository, sch *domain.Schedule) error {
		if endsBefore(*sch, from) {
			return ErrScheduleEnded
		}
		if err := repo.SetEndsOn(ctx, userID, sch.ID, from); err != nil {
			return err
		}
		_, err := repo.DeleteExpected(ctx, userID, sch.ID, from, lastDate, true)
		return err
	})
}

// regenerate inserts the occurrences of sch from from to its GeneratedUntil that are missing.
func (s *Service) regenerate(ctx context.Context, repo Repository, userID int64, sch domain.Schedule, from time.Time) error {
	days, err := s.days(ctx, sch.Calendar, sch.Terms[0].Rule.Start, sch.GeneratedUntil)
	if err != nil {
		return err
	}
	return repo.InsertOccurrences(ctx, userID, sch.ID, sch.Planned(from, sch.GeneratedUntil, days))
}
