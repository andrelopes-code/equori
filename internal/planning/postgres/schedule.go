package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (r *Repository) InsertSchedule(
	ctx context.Context,
	booksID int64,
	s domain.Schedule,
) (domain.Schedule, error) {
	row, err := r.q.InsertSchedule(ctx, InsertScheduleParams{
		BooksID:       booksID,
		Kind:          string(s.Kind),
		AccountID:     s.AccountID,
		CounterpartID: s.CounterpartID,
		PayeeID:       nullUUID(s.PayeeID),
		Description:   s.Description,
		Currency:      string(s.Currency),
		MatchToleranceBp: int32(
			s.ToleranceBP,
		),
		GraceDays:       int32(s.GraceDays),
		MatchWindowDays: int32(s.WindowDays),
		GeneratedUntil:  s.GeneratedUntil,
		Calendar:        s.Calendar, //nolint:gosec // validated to 0-10000 and 0-31
		CreatedAt:       s.CreatedAt,
	})
	if err != nil {
		return domain.Schedule{}, fmt.Errorf("insert schedule: %w", err)
	}

	for _, t := range s.Terms {
		if err := r.insertTerms(ctx, booksID, row.ID, t); err != nil {
			return domain.Schedule{}, err
		}
	}

	out := toSchedule(row)
	out.Terms = s.Terms

	return out, nil
}

func (r *Repository) insertTerms(
	ctx context.Context,
	booksID int64,
	scheduleID uuid.UUID,
	t domain.Terms,
) error {
	rule := t.Rule

	var weekday *int32
	if rule.Weekday != nil {
		w := int32(*rule.Weekday) //nolint:gosec // a weekday is 0-6
		weekday = &w
	}

	err := r.q.InsertTerms(ctx, InsertTermsParams{
		BooksID:       booksID,
		ScheduleID:    scheduleID,
		EffectiveFrom: t.EffectiveFrom,
		Frequency:     string(rule.Frequency),
		Interval: int32(
			rule.Interval,
		),
		DayOfMonth: intPtr(rule.DayOfMonth),
		Weekday:    weekday,
		Ordinal:    intPtr(rule.Ordinal), //nolint:gosec // interval is at most 120 (contract)
		BusinessDayOrdinal: intPtr(
			rule.BusinessDayOrdinal,
		),
		Adjustment:    rule.Adjustment,
		Start:         rule.Start,
		Until:         rule.Until,
		Count:         intPtr(rule.Count),
		Amount:        t.Amount,
		FirstSequence: intPtr(t.FirstSequence),
	})
	if err != nil {
		return fmt.Errorf("insert schedule terms: %w", err)
	}

	return nil
}

func toSchedule(row PlanningSchedule) domain.Schedule {
	return domain.Schedule{
		ID:            row.ID,
		Kind:          domain.Kind(row.Kind),
		AccountID:     row.AccountID,
		CounterpartID: row.CounterpartID,
		PayeeID:       row.PayeeID.UUID,
		Description:   row.Description,
		Currency:      money.Currency(row.Currency),
		ToleranceBP: int(
			row.MatchToleranceBp,
		),
		GraceDays:      int(row.GraceDays),
		WindowDays:     int(row.MatchWindowDays),
		Calendar:       row.Calendar,
		EndsOn:         row.EndsOn,
		GeneratedUntil: row.GeneratedUntil,
		CreatedAt:      row.CreatedAt,
	}
}

func toTerms(row PlanningScheduleTerm) domain.Terms {
	rule := domain.Rule{
		Frequency: domain.Frequency(
			row.Frequency,
		),
		Interval:   int(row.Interval),
		DayOfMonth: fromPtr(row.DayOfMonth),
		Ordinal: fromPtr(
			row.Ordinal,
		),
		BusinessDayOrdinal: fromPtr(row.BusinessDayOrdinal),
		Adjustment:         row.Adjustment,
		Start:              row.Start,
		Until:              row.Until,
		Count:              fromPtr(row.Count),
	}
	if row.Weekday != nil {
		w := time.Weekday(*row.Weekday)
		rule.Weekday = &w
	}

	return domain.Terms{
		EffectiveFrom: row.EffectiveFrom,
		Rule:          rule,
		Amount:        row.Amount,
		FirstSequence: fromPtr(row.FirstSequence),
	}
}

// complete loads the terms and pauses of schedules.
func (r *Repository) complete(
	ctx context.Context,
	rows []PlanningSchedule,
) ([]domain.Schedule, error) {
	if len(rows) == 0 {
		return nil, nil
	}

	ids := make([]uuid.UUID, len(rows))
	byID := make(map[uuid.UUID]*domain.Schedule, len(rows))

	out := make([]domain.Schedule, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
		out[i] = toSchedule(row)
		byID[row.ID] = &out[i]
	}

	terms, err := r.q.ListTerms(ctx, ListTermsParams{BooksID: rows[0].BooksID, ScheduleIds: ids})
	if err != nil {
		return nil, fmt.Errorf("list schedule terms: %w", err)
	}

	for _, t := range terms {
		s := byID[t.ScheduleID]
		s.Terms = append(s.Terms, toTerms(t))
	}

	pauses, err := r.q.ListPauses(ctx, ListPausesParams{BooksID: rows[0].BooksID, ScheduleIds: ids})
	if err != nil {
		return nil, fmt.Errorf("list schedule pauses: %w", err)
	}

	for _, p := range pauses {
		s := byID[p.ScheduleID]
		s.Pauses = append(s.Pauses, domain.Pause{From: p.FromDate, To: p.ToDate})
	}

	return out, nil
}

func (r *Repository) one(
	ctx context.Context,
	row PlanningSchedule,
	err error,
) (domain.Schedule, error) {
	if err != nil {
		return domain.Schedule{}, notFound(err)
	}

	out, err := r.complete(ctx, []PlanningSchedule{row})
	if err != nil {
		return domain.Schedule{}, err
	}

	return out[0], nil
}

func (r *Repository) Schedule(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.Schedule, error) {
	row, err := r.q.GetSchedule(ctx, GetScheduleParams{BooksID: booksID, ID: id})
	return r.one(ctx, row, err)
}

func (r *Repository) LockSchedule(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.Schedule, error) {
	row, err := r.q.LockSchedule(ctx, LockScheduleParams{BooksID: booksID, ID: id})
	return r.one(ctx, row, err)
}

func (r *Repository) UpdateScheduleDescription(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	description string,
) (domain.Schedule, error) {
	row, err := r.q.UpdateScheduleDescription(ctx, UpdateScheduleDescriptionParams{
		BooksID: booksID, ID: id, Description: description,
	})

	return r.one(ctx, row, err)
}

func (r *Repository) UpdateScheduleMatching(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	tolerance, grace, window int,
) (domain.Schedule, error) {
	row, err := r.q.UpdateScheduleMatching(ctx, UpdateScheduleMatchingParams{
		BooksID: booksID,
		ID:      id,
		MatchToleranceBp: int32(
			tolerance,
		),
		GraceDays:       int32(grace),
		MatchWindowDays: int32(window), //nolint:gosec // validated to 0-10000 and 0-31
	})

	return r.one(ctx, row, err)
}

func (r *Repository) ListSchedules(
	ctx context.Context,
	booksID int64,
	p page.Request[app.IDKey],
) ([]domain.Schedule, *app.IDKey, error) {
	after, limit := keyset(p)

	rows, err := r.q.ListSchedules(
		ctx,
		ListSchedulesParams{BooksID: booksID, AfterID: after, RowLimit: limit},
	)
	if err != nil {
		return nil, nil, fmt.Errorf("list schedules: %w", err)
	}

	rows, next := trim(rows, p.Limit, func(s PlanningSchedule) uuid.UUID { return s.ID })
	out, err := r.complete(ctx, rows)

	return out, next, err
}

func (r *Repository) Schedules(ctx context.Context, booksID int64) ([]domain.Schedule, error) {
	rows, err := r.q.SchedulesOfBooks(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("list schedules of books: %w", err)
	}

	return r.complete(ctx, rows)
}

func (r *Repository) SchedulesBehind(
	ctx context.Context,
	horizon time.Time,
) ([]app.ScheduleRef, error) {
	rows, err := r.q.SchedulesBehind(ctx, horizon)
	if err != nil {
		return nil, fmt.Errorf("list schedules behind: %w", err)
	}

	out := make([]app.ScheduleRef, len(rows))
	for i, row := range rows {
		out[i] = app.ScheduleRef{BooksID: row.BooksID, ID: row.ID}
	}

	return out, nil
}

func (r *Repository) ScheduleRefs(ctx context.Context) ([]app.ScheduleRef, error) {
	rows, err := r.q.ScheduleRefs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list schedules: %w", err)
	}

	out := make([]app.ScheduleRef, len(rows))
	for i, row := range rows {
		out[i] = app.ScheduleRef{BooksID: row.BooksID, ID: row.ID}
	}

	return out, nil
}

func (r *Repository) SetGeneratedUntil(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	d time.Time,
) error {
	return r.q.SetGeneratedUntil(
		ctx,
		SetGeneratedUntilParams{BooksID: booksID, ID: id, GeneratedUntil: d},
	)
}

func (r *Repository) InsertTerms(
	ctx context.Context,
	booksID int64,
	scheduleID uuid.UUID,
	t domain.Terms,
) error {
	return r.insertTerms(ctx, booksID, scheduleID, t)
}

// MoveScheduleStart moves the first terms version from oldStart to newStart and renumbers the
// occurrences and the later terms versions by shift, the dates the rule gained before them.
func (r *Repository) MoveScheduleStart(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	oldStart, newStart time.Time,
	shift int,
) error {
	steps := []func() error{
		func() error {
			return r.q.MoveFirstTermsStart(
				ctx,
				MoveFirstTermsStartParams{
					BooksID:    booksID,
					ScheduleID: id,
					OldStart:   oldStart,
					NewStart:   newStart,
				},
			)
		},
		func() error {
			return r.q.ShiftTermsFirstSequence(
				ctx,
				ShiftTermsFirstSequenceParams{
					BooksID:    booksID,
					ScheduleID: id,
					Shift:      int32(shift),
				},
			) //nolint:gosec // a count of dates of one rule
		},
		func() error {
			return r.q.LiftOccurrenceSequences(
				ctx,
				LiftOccurrenceSequencesParams{BooksID: booksID, ScheduleID: id},
			)
		},
		func() error {
			return r.q.LowerOccurrenceSequences(
				ctx,
				LowerOccurrenceSequencesParams{
					BooksID:    booksID,
					ScheduleID: id,
					Shift:      int32(shift),
				},
			) //nolint:gosec // a count of dates of one rule
		},
	}
	for _, step := range steps {
		if err := step(); err != nil {
			return fmt.Errorf("move schedule start: %w", err)
		}
	}

	return nil
}

func (r *Repository) InsertPause(
	ctx context.Context,
	booksID int64,
	scheduleID uuid.UUID,
	p domain.Pause,
) error {
	err := r.q.InsertPause(
		ctx,
		InsertPauseParams{BooksID: booksID, ScheduleID: scheduleID, FromDate: p.From, ToDate: p.To},
	)
	if pe, ok := errors.AsType[*pgconn.PgError](err); ok && pe.Code == exclusionViolation {
		return app.ErrPauseOverlap
	}

	if err != nil {
		return fmt.Errorf("insert pause: %w", err)
	}

	return nil
}

func (r *Repository) SetEndsOn(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	d time.Time,
) error {
	return r.q.SetEndsOn(ctx, SetEndsOnParams{BooksID: booksID, ID: id, EndsOn: &d})
}
