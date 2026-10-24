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

func (s *Service) horizon() time.Time { return s.clk.Today().AddDate(0, horizonMonths, 0) }

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
func (s *Service) generate(ctx context.Context, repo Repository, userID int64, sch domain.Schedule) error {
	horizon := s.horizon()
	if !sch.GeneratedUntil.Before(horizon) {
		return nil
	}
	if err := s.fill(ctx, repo, userID, sch, sch.GeneratedUntil.AddDate(0, 0, 1), horizon); err != nil {
		return err
	}
	return repo.SetGeneratedUntil(ctx, userID, sch.ID, horizon)
}

// fill inserts the occurrences of sch dated in [from, to] that are missing, lets the
// transactions already recorded realize the ones dated by today (A51), and skips the ones dated
// before the schedule's creation that none realizes, so the past is neither overdue nor
// projected (A127).
func (s *Service) fill(ctx context.Context, repo Repository, userID int64, sch domain.Schedule, from, to time.Time) error {
	days, err := s.days(ctx, sch.Calendar, sch.Terms[0].Rule.Start, to)
	if err != nil {
		return err
	}
	planned := sch.Planned(from, to, days)
	if err := repo.InsertOccurrences(ctx, userID, sch.ID, planned); err != nil {
		return err
	}
	today := s.clk.Today()
	if len(planned) == 0 || planned[0].Date.After(today.AddDate(0, 0, domain.MatchWindowDays)) {
		return nil
	}
	first := planned[0].Date
	ids, err := s.ledger.AccountTransactionsBetween(ctx, userID, sch.AccountID,
		first.AddDate(0, 0, -domain.MatchWindowDays), today.AddDate(0, 0, domain.MatchWindowDays))
	if err != nil {
		return err
	}
	for _, id := range ids {
		e := TransactionChanged{UserID: userID, TransactionID: id, AccountIDs: []uuid.UUID{sch.AccountID}}
		if err := s.reevaluate(ctx, repo, e); err != nil {
			return err
		}
	}
	created := clock.DateOf(sch.CreatedAt, s.clk.Location())
	open, err := repo.ExpectedOccurrences(ctx, userID, []uuid.UUID{sch.ID}, first, created.AddDate(0, 0, -1))
	if err != nil {
		return err
	}
	for _, o := range open {
		if _, err := repo.Skip(ctx, userID, o.ID, ""); err != nil {
			return err
		}
	}
	return nil
}

// Backfill fills every schedule from its rule's first date to the date it is generated
// through: what creation does since A127, for schedules created before it.
func (s *Service) Backfill(ctx context.Context) error {
	refs, err := s.repo.ScheduleRefs(ctx)
	if err != nil {
		return err
	}
	for _, ref := range refs {
		err := s.repo.InTx(ctx, func(repo Repository) error {
			sch, err := repo.LockSchedule(ctx, ref.UserID, ref.ID)
			if err != nil {
				return err
			}
			return s.fill(ctx, repo, ref.UserID, sch, time.Time{}, sch.GeneratedUntil)
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
	refs, err := s.repo.SchedulesBehind(ctx, s.horizon())
	if err != nil {
		return nil, err
	}
	var failures []Failure
	for _, ref := range refs {
		err := s.repo.InTx(ctx, func(repo Repository) error {
			sch, err := repo.LockSchedule(ctx, ref.UserID, ref.ID)
			if err != nil {
				return err
			}
			return s.generate(ctx, repo, ref.UserID, sch)
		})
		if err != nil {
			failures = append(failures, Failure{Ref: ref, Err: err})
		}
	}
	return failures, nil
}
