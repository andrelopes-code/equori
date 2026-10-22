package app

import (
	"context"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
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
	days, err := s.days(ctx, sch.Calendar, sch.Terms[0].Rule.Start, horizon)
	if err != nil {
		return err
	}
	planned := sch.Planned(sch.GeneratedUntil.AddDate(0, 0, 1), horizon, days)
	if err := repo.InsertOccurrences(ctx, userID, sch.ID, planned); err != nil {
		return err
	}
	return repo.SetGeneratedUntil(ctx, userID, sch.ID, horizon)
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
