package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

var _ app.Repository = (*Repository)(nil)

// Repository runs on the pool, or on a transaction inside InTx.
type Repository struct {
	pool *pgxpool.Pool
	q    *Queries
}

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool, q: New(pool)} }

// NewTxRepository runs on tx, as outbox handlers do.
func NewTxRepository(tx pgx.Tx) *Repository { return &Repository{q: New(tx)} }

func (r *Repository) InTx(ctx context.Context, fn func(app.Repository) error) error {
	if r.pool == nil {
		return fn(r)
	}
	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error { return fn(NewTxRepository(tx)) })
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return app.ErrNotFound
	}
	return err
}

func nullUUID(id uuid.UUID) uuid.NullUUID { return uuid.NullUUID{UUID: id, Valid: id != uuid.Nil} }

func intPtr(v int) *int32 {
	if v == 0 {
		return nil
	}
	n := int32(v) //nolint:gosec // rule fields are validated to small ranges (A48)
	return &n
}

func fromPtr(p *int32) int {
	if p == nil {
		return 0
	}
	return int(*p)
}

func (r *Repository) InsertSchedule(ctx context.Context, userID int64, s domain.Schedule) (domain.Schedule, error) {
	row, err := r.q.InsertSchedule(ctx, InsertScheduleParams{
		UserID: userID, Kind: string(s.Kind), AccountID: s.AccountID, CounterpartID: s.CounterpartID,
		PayeeID: nullUUID(s.PayeeID), Description: s.Description, Currency: string(s.Currency),
		MatchToleranceBp: int32(s.ToleranceBP), GraceDays: int32(s.GraceDays), GeneratedUntil: s.GeneratedUntil, //nolint:gosec // validated to 0-10000 and 0-31
	})
	if err != nil {
		return domain.Schedule{}, fmt.Errorf("insert schedule: %w", err)
	}
	for _, t := range s.Terms {
		if err := r.insertTerms(ctx, userID, row.ID, t); err != nil {
			return domain.Schedule{}, err
		}
	}
	out := toSchedule(row)
	out.Terms = s.Terms
	return out, nil
}

func (r *Repository) insertTerms(ctx context.Context, userID int64, scheduleID uuid.UUID, t domain.Terms) error {
	rule := t.Rule
	var weekday *int32
	if rule.Weekday != nil {
		w := int32(*rule.Weekday) //nolint:gosec // a weekday is 0-6
		weekday = &w
	}
	err := r.q.InsertTerms(ctx, InsertTermsParams{
		UserID: userID, ScheduleID: scheduleID, EffectiveFrom: t.EffectiveFrom, Frequency: string(rule.Frequency),
		Interval: int32(rule.Interval), DayOfMonth: intPtr(rule.DayOfMonth), Weekday: weekday, Ordinal: intPtr(rule.Ordinal), //nolint:gosec // interval is at most 120 (contract)
		BusinessDayOrdinal: intPtr(rule.BusinessDayOrdinal), Adjustment: rule.Adjustment, Calendar: "br_banking",
		Start: rule.Start, Until: rule.Until, Count: intPtr(rule.Count), Amount: t.Amount,
	})
	if err != nil {
		return fmt.Errorf("insert schedule terms: %w", err)
	}
	return nil
}

func toSchedule(row PlanningSchedule) domain.Schedule {
	return domain.Schedule{
		ID: row.ID, Kind: domain.Kind(row.Kind), AccountID: row.AccountID, CounterpartID: row.CounterpartID,
		PayeeID: row.PayeeID.UUID, Description: row.Description, Currency: money.Currency(row.Currency),
		ToleranceBP: int(row.MatchToleranceBp), GraceDays: int(row.GraceDays), EndsOn: row.EndsOn, GeneratedUntil: row.GeneratedUntil,
	}
}

func toTerms(row PlanningScheduleTerm) domain.Terms {
	rule := domain.Rule{
		Frequency: domain.Frequency(row.Frequency), Interval: int(row.Interval), DayOfMonth: fromPtr(row.DayOfMonth),
		Ordinal: fromPtr(row.Ordinal), BusinessDayOrdinal: fromPtr(row.BusinessDayOrdinal), Adjustment: row.Adjustment,
		Start: row.Start, Until: row.Until, Count: fromPtr(row.Count),
	}
	if row.Weekday != nil {
		w := time.Weekday(*row.Weekday)
		rule.Weekday = &w
	}
	return domain.Terms{EffectiveFrom: row.EffectiveFrom, Rule: rule, Amount: row.Amount}
}

// complete loads the terms and pauses of schedules.
func (r *Repository) complete(ctx context.Context, rows []PlanningSchedule) ([]domain.Schedule, error) {
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
	terms, err := r.q.ListTerms(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("list schedule terms: %w", err)
	}
	for _, t := range terms {
		s := byID[t.ScheduleID]
		s.Terms = append(s.Terms, toTerms(t))
	}
	pauses, err := r.q.ListPauses(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("list schedule pauses: %w", err)
	}
	for _, p := range pauses {
		s := byID[p.ScheduleID]
		s.Pauses = append(s.Pauses, domain.Pause{From: p.FromDate, To: p.ToDate})
	}
	return out, nil
}

func (r *Repository) one(ctx context.Context, row PlanningSchedule, err error) (domain.Schedule, error) {
	if err != nil {
		return domain.Schedule{}, notFound(err)
	}
	out, err := r.complete(ctx, []PlanningSchedule{row})
	if err != nil {
		return domain.Schedule{}, err
	}
	return out[0], nil
}

func (r *Repository) Schedule(ctx context.Context, userID int64, id uuid.UUID) (domain.Schedule, error) {
	row, err := r.q.GetSchedule(ctx, GetScheduleParams{UserID: userID, ID: id})
	return r.one(ctx, row, err)
}

func (r *Repository) LockSchedule(ctx context.Context, userID int64, id uuid.UUID) (domain.Schedule, error) {
	row, err := r.q.LockSchedule(ctx, LockScheduleParams{UserID: userID, ID: id})
	return r.one(ctx, row, err)
}

func (r *Repository) ListSchedules(ctx context.Context, userID int64, p page.Request[app.IDKey]) ([]domain.Schedule, *app.IDKey, error) {
	arg := ListSchedulesParams{UserID: userID, RowLimit: int32(p.Limit + 1)} //nolint:gosec // limit is at most page.MaxLimit
	if p.After != nil {
		arg.AfterID = nullUUID(p.After.ID)
	}
	rows, err := r.q.ListSchedules(ctx, arg)
	if err != nil {
		return nil, nil, fmt.Errorf("list schedules: %w", err)
	}
	var next *app.IDKey
	if len(rows) > p.Limit {
		rows = rows[:p.Limit]
		next = &app.IDKey{ID: rows[len(rows)-1].ID}
	}
	out, err := r.complete(ctx, rows)
	return out, next, err
}

func (r *Repository) Schedules(ctx context.Context, userID int64) ([]domain.Schedule, error) {
	rows, err := r.q.SchedulesOfUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list schedules of user: %w", err)
	}
	return r.complete(ctx, rows)
}

func (r *Repository) SchedulesBehind(ctx context.Context, horizon time.Time) ([]app.ScheduleRef, error) {
	rows, err := r.q.SchedulesBehind(ctx, horizon)
	if err != nil {
		return nil, fmt.Errorf("list schedules behind: %w", err)
	}
	out := make([]app.ScheduleRef, len(rows))
	for i, row := range rows {
		out[i] = app.ScheduleRef{UserID: row.UserID, ID: row.ID}
	}
	return out, nil
}

func (r *Repository) SetGeneratedUntil(ctx context.Context, userID int64, id uuid.UUID, d time.Time) error {
	return r.q.SetGeneratedUntil(ctx, SetGeneratedUntilParams{UserID: userID, ID: id, GeneratedUntil: d})
}

func (r *Repository) InsertOccurrences(ctx context.Context, userID int64, scheduleID uuid.UUID, ps []domain.Planned) error {
	if len(ps) == 0 {
		return nil
	}
	arg := InsertOccurrencesParams{UserID: userID, ScheduleID: scheduleID}
	for _, p := range ps {
		arg.Sequences = append(arg.Sequences, int32(p.Sequence)) //nolint:gosec // sequences stay far below 2^31
		arg.Dates = append(arg.Dates, p.Date.Format(time.DateOnly))
		arg.Amounts = append(arg.Amounts, p.Amount)
	}
	if err := r.q.InsertOccurrences(ctx, arg); err != nil {
		return fmt.Errorf("insert occurrences: %w", err)
	}
	return nil
}

func toOccurrence(row PlanningOccurrence) domain.Occurrence {
	o := domain.Occurrence{
		ID: row.ID, ScheduleID: row.ScheduleID, Sequence: int(row.Sequence), ExpectedOn: row.ExpectedOn,
		Amount: row.ExpectedAmount, State: domain.State(row.State), TransactionID: row.TransactionID.UUID, MovedFrom: row.MovedFrom,
	}
	if row.RealizedBy != nil {
		o.RealizedBy = *row.RealizedBy
	}
	if row.SkipReason != nil {
		o.SkipReason = *row.SkipReason
	}
	return o
}

func (r *Repository) Occurrences(ctx context.Context, userID int64, from, to time.Time, scheduleID uuid.UUID) ([]domain.Occurrence, error) {
	rows, err := r.q.ListOccurrences(ctx, ListOccurrencesParams{UserID: userID, FromDate: from, ToDate: to, ScheduleID: nullUUID(scheduleID)})
	if err != nil {
		return nil, fmt.Errorf("list occurrences: %w", err)
	}
	out := make([]domain.Occurrence, len(rows))
	for i, row := range rows {
		out[i] = toOccurrence(row)
	}
	return out, nil
}
