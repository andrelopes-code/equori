package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ReviseTerms replaces the latest terms version, dated latestFrom, by one from effectiveFrom;
// an absent amount or rule keeps the value of the version replaced. The first version keeps its
// date and its rule. Expected occurrences that were not moved, from the earlier of the two
// dates on, are regenerated (A269, TR1, TR2, TR5).
func (s *Service) ReviseTerms(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	latestFrom, effectiveFrom time.Time,
	amount *money.Money,
	rule *domain.Rule,
) (domain.Schedule, error) {
	return s.changeSchedule(ctx, booksID, id, func(repo Repository, sch *domain.Schedule) error {
		old, err := latestTerms(*sch, latestFrom)
		if err != nil {
			return err
		}

		if endsBefore(*sch, effectiveFrom) {
			return ErrScheduleEnded
		}

		if len(sch.Terms) == 1 {
			return s.reviseFirstTerms(ctx, repo, booksID, sch, effectiveFrom, amount, rule)
		}

		sch.Terms = sch.Terms[:len(sch.Terms)-1]
		if err := afterLatest(*sch, effectiveFrom); err != nil {
			return err
		}

		base := domain.Terms{EffectiveFrom: effectiveFrom, Rule: old.Rule, Amount: old.Amount}

		next, err := withChanges(*sch, base, amount, rule)
		if err != nil {
			return err
		}

		sch.Terms = append(sch.Terms, next)
		if err := sch.Validate(); err != nil {
			return err
		}

		from := earlier(old.EffectiveFrom, effectiveFrom)

		removed, err := s.dropTerms(ctx, repo, booksID, sch.ID, old.EffectiveFrom, from)
		if err != nil {
			return err
		}

		if _, err := s.persistTerms(ctx, repo, booksID, sch, effectiveFrom); err != nil {
			return err
		}

		start := regenerationStart(s.clk.Today(ctx), removed, from)

		return s.regenerate(ctx, repo, booksID, *sch, start)
	})
}

// RemoveTerms removes the latest terms version, dated latestFrom; the previous one applies again
// from that date (A269, TR3, TR5).
func (s *Service) RemoveTerms(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	latestFrom time.Time,
) (domain.Schedule, error) {
	return s.changeSchedule(ctx, booksID, id, func(repo Repository, sch *domain.Schedule) error {
		if _, err := latestTerms(*sch, latestFrom); err != nil {
			return err
		}

		if len(sch.Terms) == 1 {
			return ErrTermsFirst
		}

		sch.Terms = sch.Terms[:len(sch.Terms)-1]

		removed, err := s.dropTerms(ctx, repo, booksID, sch.ID, latestFrom, latestFrom)
		if err != nil {
			return err
		}

		start := regenerationStart(s.clk.Today(ctx), removed, latestFrom)

		return s.regenerate(ctx, repo, booksID, *sch, start)
	})
}

// reviseFirstTerms changes the amount of the only terms version of sch in place.
func (s *Service) reviseFirstTerms(
	ctx context.Context,
	repo Repository,
	booksID int64,
	sch *domain.Schedule,
	effectiveFrom time.Time,
	amount *money.Money,
	rule *domain.Rule,
) error {
	old := sch.Terms[0]
	if !effectiveFrom.Equal(old.EffectiveFrom) {
		return &domain.FieldError{
			Field:   "effective_from",
			Message: "the first terms version starts with the schedule",
			Err:     domain.ErrValidation,
		}
	}

	if rule != nil {
		return &domain.FieldError{
			Field:   "recurrence",
			Message: "the first terms version keeps its recurrence; add a version to change it",
			Err:     domain.ErrValidation,
		}
	}

	next, err := withChanges(*sch, old, amount, nil)
	if err != nil {
		return err
	}

	sch.Terms[0] = next
	if err := sch.Validate(); err != nil {
		return err
	}

	removed, err := s.dropTerms(ctx, repo, booksID, sch.ID, old.EffectiveFrom, old.EffectiveFrom)
	if err != nil {
		return err
	}

	if err := repo.InsertTerms(ctx, booksID, sch.ID, next); err != nil {
		return err
	}

	start := regenerationStart(s.clk.Today(ctx), removed, old.EffectiveFrom)

	return s.regenerate(ctx, repo, booksID, *sch, start)
}

// dropTerms deletes the terms version dated effectiveFrom and the expected occurrences that were
// not moved from from on; it returns the dates removed.
func (s *Service) dropTerms(
	ctx context.Context,
	repo Repository,
	booksID int64,
	scheduleID uuid.UUID,
	effectiveFrom, from time.Time,
) ([]time.Time, error) {
	if err := repo.DeleteTerms(ctx, booksID, scheduleID, effectiveFrom); err != nil {
		return nil, err
	}

	return repo.DeleteExpected(ctx, booksID, scheduleID, from, lastDate, false)
}

// latestTerms returns the latest terms version of sch when it is dated from.
func latestTerms(sch domain.Schedule, from time.Time) (domain.Terms, error) {
	latest := sch.Terms[len(sch.Terms)-1]
	if !latest.EffectiveFrom.Equal(from) {
		return domain.Terms{}, ErrTermsNotLatest
	}

	return latest, nil
}

func earlier(a, b time.Time) time.Time {
	if b.Before(a) {
		return b
	}

	return a
}
