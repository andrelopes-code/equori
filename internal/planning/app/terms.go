package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ChangeTerms adds a terms version from effectiveFrom; without rule the previous rule is kept,
// start included (A49). Expected occurrences from that date on that were not moved are
// regenerated (A52).
func (s *Service) ChangeTerms(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	effectiveFrom time.Time,
	amount *money.Money,
	rule *domain.Rule,
) (domain.Schedule, error) {
	return s.changeSchedule(ctx, booksID, id, func(repo Repository, sch *domain.Schedule) error {
		if endsBefore(*sch, effectiveFrom) {
			return ErrScheduleEnded
		}

		next, err := nextTerms(*sch, effectiveFrom, amount, rule)
		if err != nil {
			return err
		}

		sch.Terms = append(sch.Terms, next)
		if err := sch.Validate(); err != nil {
			return err
		}

		removed, err := s.persistTerms(ctx, repo, booksID, sch, effectiveFrom)
		if err != nil {
			return err
		}

		return s.regenerate(
			ctx,
			repo,
			booksID,
			*sch,
			regenerationStart(s.clk.Today(ctx), removed, effectiveFrom),
		)
	})
}

// nextTerms validates the arguments of ChangeTerms and builds the terms version they describe.
func nextTerms(
	sch domain.Schedule,
	effectiveFrom time.Time,
	amount *money.Money,
	rule *domain.Rule,
) (domain.Terms, error) {
	last := sch.Terms[len(sch.Terms)-1]
	if !effectiveFrom.After(last.EffectiveFrom) {
		return domain.Terms{}, &domain.FieldError{
			Field:   "effective_from",
			Message: "must be after the latest terms version",
			Err:     domain.ErrValidation,
		}
	}

	if amount == nil && rule == nil {
		return domain.Terms{}, &domain.FieldError{
			Field:   "amount",
			Message: "amount or recurrence is required",
			Err:     domain.ErrValidation,
		}
	}

	next := domain.Terms{EffectiveFrom: effectiveFrom, Rule: last.Rule, Amount: last.Amount}
	if amount != nil {
		if amount.Currency() != sch.Currency {
			return domain.Terms{}, &domain.FieldError{
				Field:   "amount.currency",
				Message: "must be the schedule currency " + string(sch.Currency),
				Err:     domain.ErrValidation,
			}
		}

		next.Amount = amount.Amount()
	}

	if rule != nil {
		next.Rule = *rule
		if next.Rule.Adjustment == "" {
			next.Rule.Adjustment = "none"
		}
	}

	return next, nil
}

// persistTerms stores the latest terms version of sch and deletes the expected occurrences from
// effectiveFrom on; it returns the dates removed.
func (s *Service) persistTerms(
	ctx context.Context,
	repo Repository,
	booksID int64,
	sch *domain.Schedule,
	effectiveFrom time.Time,
) ([]time.Time, error) {
	first, err := s.firstSequence(ctx, repo, booksID, *sch)
	if err != nil {
		return nil, err
	}

	sch.Terms[len(sch.Terms)-1].FirstSequence = first
	if err := repo.InsertTerms(ctx, booksID, sch.ID, sch.Terms[len(sch.Terms)-1]); err != nil {
		return nil, err
	}

	return repo.DeleteExpected(ctx, booksID, sch.ID, effectiveFrom, lastDate, false)
}

// regenerationStart is the date to regenerate from: only where occurrences existed, from today,
// or from the earliest date removed when it is earlier, never before the effective date.
func regenerationStart(today time.Time, removed []time.Time, effectiveFrom time.Time) time.Time {
	from := today
	for _, d := range removed {
		if d.Before(from) {
			from = d
		}
	}

	if from.Before(effectiveFrom) {
		from = effectiveFrom
	}

	return from
}

// firstSequence returns the first sequence of the latest terms version of sch: 0 to continue
// after the earlier versions, unless a kept occurrence holds one of the sequences the version
// would take for another date; then the version starts after the highest kept sequence.
func (s *Service) firstSequence(
	ctx context.Context,
	repo Repository,
	booksID int64,
	sch domain.Schedule,
) (int, error) {
	latest := sch.Terms[len(sch.Terms)-1]

	kept, err := repo.KeptOccurrences(ctx, booksID, sch.ID, latest.EffectiveFrom)
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

// regenerate inserts the occurrences of sch from from to its GeneratedUntil that are missing.
func (s *Service) regenerate(
	ctx context.Context,
	repo Repository,
	booksID int64,
	sch domain.Schedule,
	from time.Time,
) error {
	days, err := s.days(ctx, sch.Calendar, sch.Terms[0].Rule.Start, sch.GeneratedUntil)
	if err != nil {
		return err
	}

	return repo.InsertOccurrences(ctx, booksID, sch.ID, sch.Planned(from, sch.GeneratedUntil, days))
}
