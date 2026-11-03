package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
)

// horizonMonths bounds generation: occurrences reach today + 12 months (A49).
const horizonMonths = 12

func (s *Service) horizon(ctx context.Context) time.Time {
	return s.clk.Today(ctx).AddDate(0, horizonMonths, 0)
}

// businessDays is a BusinessDays over the holidays of the years it loaded.
type businessDays map[time.Time]bool

func (b businessDays) IsBusinessDay(d time.Time) bool {
	if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
		return false
	}

	return !b[d]
}

// days loads the holidays of the years [from, to] touches, plus one year on each side for
// adjustments that cross a year boundary.
func (s *Service) days(ctx context.Context, calendar string, from, to time.Time) (businessDays, error) {
	out := businessDays{}
	for y := from.Year() - 1; y <= to.Year()+1; y++ {
		hs, err := s.cal.Holidays(ctx, calendar, y)
		if err != nil {
			return nil, fmt.Errorf("load holidays %d: %w", y, err)
		}

		for _, h := range hs {
			out[h] = true
		}
	}

	return out, nil
}

// generate adds the occurrences of sch after its GeneratedUntil up to the horizon and
// advances GeneratedUntil; existing sequences are kept (A49).
func (s *Service) generate(ctx context.Context, repo Repository, booksID int64, sch domain.Schedule, paidBy uuid.UUID) error {
	horizon := s.horizon(ctx)
	if !sch.GeneratedUntil.Before(horizon) {
		return nil
	}

	if err := s.fill(ctx, repo, booksID, sch, sch.GeneratedUntil.AddDate(0, 0, 1), horizon, paidBy); err != nil {
		return err
	}

	return repo.SetGeneratedUntil(ctx, booksID, sch.ID, horizon)
}

// fill inserts the occurrences of sch dated in [from, to] that are missing, lets the
// transactions already recorded realize the ones dated by today (A51), and skips the ones dated
// before the schedule's creation that none realizes, so the past is neither overdue nor
// projected (A127).
func (s *Service) fill(ctx context.Context, repo Repository, booksID int64, sch domain.Schedule, from, to time.Time, paidBy uuid.UUID) error {
	days, err := s.days(ctx, sch.Calendar, sch.Terms[0].Rule.Start, to)
	if err != nil {
		return err
	}

	planned := sch.Planned(from, to, days)
	if err := repo.InsertOccurrences(ctx, booksID, sch.ID, planned); err != nil {
		return err
	}

	if paidBy != uuid.Nil && len(planned) > 0 {
		if err := s.realizeFirst(ctx, repo, booksID, sch.ID, planned[0].Date, paidBy); err != nil {
			return err
		}
	}

	today := s.clk.Today(ctx)
	if len(planned) == 0 || planned[0].Date.After(today.AddDate(0, 0, domain.MatchWindowDays)) {
		return nil
	}

	first := planned[0].Date

	ids, err := s.ledger.AccountTransactionsBetween(ctx, booksID, sch.AccountID,
		first.AddDate(0, 0, -domain.MatchWindowDays), today.AddDate(0, 0, domain.MatchWindowDays))
	if err != nil {
		return err
	}

	for _, id := range ids {
		e := TransactionChanged{BooksID: booksID, TransactionID: id, AccountIDs: []uuid.UUID{sch.AccountID}}
		if err := s.reevaluate(ctx, repo, e); err != nil {
			return err
		}
	}

	created := clock.DateOf(sch.CreatedAt, clock.Location(ctx))

	open, err := repo.ExpectedOccurrences(ctx, booksID, []uuid.UUID{sch.ID}, first, created.AddDate(0, 0, -1))
	if err != nil {
		return err
	}

	for _, o := range open {
		if _, err := repo.Skip(ctx, booksID, o.ID, ""); err != nil {
			return err
		}
	}

	return nil
}

// realizeFirst links the occurrence on date to txID as a manual Realize does, before the
// matching pass, so that pass neither matches nor skips it.
func (s *Service) realizeFirst(ctx context.Context, repo Repository, booksID int64, scheduleID uuid.UUID, date time.Time, txID uuid.UUID) error {
	os, err := repo.Occurrences(ctx, booksID, date, date, scheduleID)
	if err != nil || len(os) == 0 {
		return err
	}

	_, err = repo.Realize(ctx, booksID, os[0].ID, txID, realizedManual)

	return err
}

// Backfill fills every schedule from its rule's first date to the date it is generated
// through: what creation does since A127, for schedules created before it.
func (s *Service) Backfill(ctx context.Context) error {
	refs, err := s.repo.ScheduleRefs(ctx)
	if err != nil {
		return err
	}

	for _, ref := range refs {
		bctx, err := s.profiles.InBooks(ctx, ref.BooksID)
		if err != nil {
			return fmt.Errorf("backfill schedule %s: %w", ref.ID, err)
		}

		err = s.repo.InTx(bctx, func(repo Repository) error {
			sch, err := repo.LockSchedule(bctx, ref.BooksID, ref.ID)
			if err != nil {
				return err
			}

			return s.fill(bctx, repo, ref.BooksID, sch, time.Time{}, sch.GeneratedUntil, uuid.Nil)
		})
		if err != nil {
			return fmt.Errorf("backfill schedule %s: %w", ref.ID, err)
		}
	}

	return nil
}

// Failure is a schedule a tick could not extend.
type Failure struct {
	Ref ScheduleRef
	Err error
}

// Tick extends every schedule whose occurrences stop before the horizon (A53).
func (s *Service) Tick(ctx context.Context) ([]Failure, error) {
	// A book's today is at most one day after UTC's; generate stops at the book's horizon.
	refs, err := s.repo.SchedulesBehind(ctx, s.horizon(ctx).AddDate(0, 0, 1))
	if err != nil {
		return nil, err
	}

	var failures []Failure
	for _, ref := range refs {
		bctx, err := s.profiles.InBooks(ctx, ref.BooksID)
		if err != nil {
			failures = append(failures, Failure{Ref: ref, Err: err})
			continue
		}

		err = s.repo.InTx(bctx, func(repo Repository) error {
			sch, err := repo.LockSchedule(bctx, ref.BooksID, ref.ID)
			if err != nil {
				return err
			}

			return s.generate(bctx, repo, ref.BooksID, sch, uuid.Nil)
		})
		if err != nil {
			failures = append(failures, Failure{Ref: ref, Err: err})
		}
	}

	return failures, nil
}
