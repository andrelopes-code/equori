package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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
		MatchToleranceBp: int32(s.ToleranceBP), GraceDays: int32(s.GraceDays), GeneratedUntil: s.GeneratedUntil, Calendar: s.Calendar, //nolint:gosec // validated to 0-10000 and 0-31
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
		BusinessDayOrdinal: intPtr(rule.BusinessDayOrdinal), Adjustment: rule.Adjustment, Start: rule.Start, Until: rule.Until, Count: intPtr(rule.Count), Amount: t.Amount, FirstSequence: intPtr(t.FirstSequence),
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
		ToleranceBP: int(row.MatchToleranceBp), GraceDays: int(row.GraceDays), Calendar: row.Calendar, EndsOn: row.EndsOn, GeneratedUntil: row.GeneratedUntil,
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
	return domain.Terms{EffectiveFrom: row.EffectiveFrom, Rule: rule, Amount: row.Amount, FirstSequence: fromPtr(row.FirstSequence)}
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
	terms, err := r.q.ListTerms(ctx, ListTermsParams{UserID: rows[0].UserID, ScheduleIds: ids})
	if err != nil {
		return nil, fmt.Errorf("list schedule terms: %w", err)
	}
	for _, t := range terms {
		s := byID[t.ScheduleID]
		s.Terms = append(s.Terms, toTerms(t))
	}
	pauses, err := r.q.ListPauses(ctx, ListPausesParams{UserID: rows[0].UserID, ScheduleIds: ids})
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

// keyset returns the cursor and the row limit of a page, one row more than asked so the
// page knows whether another follows.
func keyset(p page.Request[app.IDKey]) (uuid.NullUUID, int32) {
	var after uuid.NullUUID
	if p.After != nil {
		after = nullUUID(p.After.ID)
	}
	return after, int32(p.Limit + 1) //nolint:gosec // limit is at most page.MaxLimit
}

// trim cuts rows to the page and returns the key of its last row when another page follows.
func trim[R any](rows []R, limit int, id func(R) uuid.UUID) ([]R, *app.IDKey) {
	if len(rows) <= limit {
		return rows, nil
	}
	rows = rows[:limit]
	return rows, &app.IDKey{ID: id(rows[len(rows)-1])}
}

func (r *Repository) ListSchedules(ctx context.Context, userID int64, p page.Request[app.IDKey]) ([]domain.Schedule, *app.IDKey, error) {
	after, limit := keyset(p)
	rows, err := r.q.ListSchedules(ctx, ListSchedulesParams{UserID: userID, AfterID: after, RowLimit: limit})
	if err != nil {
		return nil, nil, fmt.Errorf("list schedules: %w", err)
	}
	rows, next := trim(rows, p.Limit, func(s PlanningSchedule) uuid.UUID { return s.ID })
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
		DeclinedTransactionID: row.DeclinedTransactionID.UUID,
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

func (r *Repository) SchedulesTouching(ctx context.Context, userID int64, accounts []uuid.UUID) ([]domain.Schedule, error) {
	rows, err := r.q.SchedulesTouching(ctx, SchedulesTouchingParams{UserID: userID, AccountIds: accounts})
	if err != nil {
		return nil, fmt.Errorf("list schedules of accounts: %w", err)
	}
	return r.complete(ctx, rows)
}

func (r *Repository) OccurrenceByTransaction(ctx context.Context, userID int64, txID uuid.UUID) (domain.Occurrence, error) {
	row, err := r.q.OccurrenceByTransaction(ctx, OccurrenceByTransactionParams{UserID: userID, TransactionID: nullUUID(txID)})
	if err != nil {
		return domain.Occurrence{}, notFound(err)
	}
	return toOccurrence(row), nil
}

func (r *Repository) ExpectedOccurrences(ctx context.Context, userID int64, schedules []uuid.UUID, from, to time.Time) ([]domain.Occurrence, error) {
	rows, err := r.q.ExpectedOccurrences(ctx, ExpectedOccurrencesParams{UserID: userID, ScheduleIds: schedules, FromDate: from, ToDate: to})
	if err != nil {
		return nil, fmt.Errorf("list expected occurrences: %w", err)
	}
	out := make([]domain.Occurrence, len(rows))
	for i, row := range rows {
		out[i] = toOccurrence(row)
	}
	return out, nil
}

func (r *Repository) LockOccurrence(ctx context.Context, userID int64, id uuid.UUID) (domain.Occurrence, error) {
	row, err := r.q.LockOccurrence(ctx, LockOccurrenceParams{UserID: userID, ID: id})
	if err != nil {
		return domain.Occurrence{}, notFound(err)
	}
	return toOccurrence(row), nil
}

// closed reports a state change between the read and the update as ErrOccurrenceClosed.
func closed(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return app.ErrOccurrenceClosed
	}
	return err
}

func (r *Repository) Realize(ctx context.Context, userID int64, id, txID uuid.UUID, by string) (domain.Occurrence, error) {
	row, err := r.q.RealizeOccurrence(ctx, RealizeOccurrenceParams{UserID: userID, ID: id, TransactionID: nullUUID(txID), RealizedBy: &by})
	// I07: another realization of the transaction committed after this one checked for it.
	if pe, ok := errors.AsType[*pgconn.PgError](err); ok && pe.Code == uniqueViolation {
		return domain.Occurrence{}, app.ErrTransactionInUse
	}
	if err != nil {
		return domain.Occurrence{}, closed(err)
	}
	return toOccurrence(row), nil
}

func (r *Repository) Release(ctx context.Context, userID int64, id uuid.UUID, decline bool) (domain.Occurrence, error) {
	row, err := r.q.ReleaseOccurrence(ctx, ReleaseOccurrenceParams{UserID: userID, ID: id, Decline: decline})
	if err != nil {
		return domain.Occurrence{}, closed(err)
	}
	return toOccurrence(row), nil
}

const exclusionViolation = "23P01"

func (r *Repository) Skip(ctx context.Context, userID int64, id uuid.UUID, reason string) (domain.Occurrence, error) {
	var p *string
	if reason != "" {
		p = &reason
	}
	row, err := r.q.SkipOccurrence(ctx, SkipOccurrenceParams{UserID: userID, ID: id, SkipReason: p})
	if err != nil {
		return domain.Occurrence{}, closed(err)
	}
	return toOccurrence(row), nil
}

func (r *Repository) Move(ctx context.Context, userID int64, id uuid.UUID, date time.Time) (domain.Occurrence, error) {
	row, err := r.q.MoveOccurrence(ctx, MoveOccurrenceParams{UserID: userID, ID: id, ExpectedOn: date})
	if err != nil {
		return domain.Occurrence{}, closed(err)
	}
	return toOccurrence(row), nil
}

func (r *Repository) DeleteExpected(ctx context.Context, userID int64, scheduleID uuid.UUID, from, to time.Time, includeMoved bool) ([]time.Time, error) {
	removed, err := r.q.DeleteExpected(ctx, DeleteExpectedParams{UserID: userID, ScheduleID: scheduleID, FromDate: from, ToDate: to, IncludeMoved: includeMoved})
	if err != nil {
		return nil, fmt.Errorf("delete expected occurrences: %w", err)
	}
	return removed, nil
}

func (r *Repository) KeptOccurrences(ctx context.Context, userID int64, scheduleID uuid.UUID, from time.Time) ([]domain.Occurrence, error) {
	rows, err := r.q.KeptOccurrences(ctx, KeptOccurrencesParams{UserID: userID, ScheduleID: scheduleID, FromDate: &from})
	if err != nil {
		return nil, fmt.Errorf("list kept occurrences: %w", err)
	}
	out := make([]domain.Occurrence, len(rows))
	for i, row := range rows {
		out[i] = toOccurrence(row)
	}
	return out, nil
}

func (r *Repository) InsertTerms(ctx context.Context, userID int64, scheduleID uuid.UUID, t domain.Terms) error {
	return r.insertTerms(ctx, userID, scheduleID, t)
}

func (r *Repository) InsertPause(ctx context.Context, userID int64, scheduleID uuid.UUID, p domain.Pause) error {
	err := r.q.InsertPause(ctx, InsertPauseParams{UserID: userID, ScheduleID: scheduleID, FromDate: p.From, ToDate: p.To})
	if pe, ok := errors.AsType[*pgconn.PgError](err); ok && pe.Code == exclusionViolation {
		return app.ErrPauseOverlap
	}
	if err != nil {
		return fmt.Errorf("insert pause: %w", err)
	}
	return nil
}

func (r *Repository) SetEndsOn(ctx context.Context, userID int64, id uuid.UUID, d time.Time) error {
	return r.q.SetEndsOn(ctx, SetEndsOnParams{UserID: userID, ID: id, EndsOn: &d})
}

const uniqueViolation = "23505"

func (r *Repository) InsertBudget(ctx context.Context, userID int64, b domain.Budget) (domain.Budget, error) {
	row, err := r.q.InsertBudget(ctx, InsertBudgetParams{UserID: userID, CategoryAccountID: b.CategoryID, Rollover: b.Rollover, Currency: string(b.Currency)})
	if pe, ok := errors.AsType[*pgconn.PgError](err); ok && pe.Code == uniqueViolation {
		return domain.Budget{}, app.ErrBudgetExists
	}
	if err != nil {
		return domain.Budget{}, fmt.Errorf("insert budget: %w", err)
	}
	for _, a := range b.Amounts {
		if err := r.InsertBudgetAmount(ctx, userID, row.ID, a); err != nil {
			return domain.Budget{}, err
		}
	}
	return r.oneBudget(ctx, row, nil)
}

func (r *Repository) InsertBudgetAmount(ctx context.Context, userID int64, budgetID uuid.UUID, a domain.BudgetAmount) error {
	err := r.q.InsertBudgetAmount(ctx, InsertBudgetAmountParams{UserID: userID, BudgetID: budgetID, EffectiveFrom: a.EffectiveFrom, Amount: a.Amount})
	if err != nil {
		return fmt.Errorf("insert budget amount: %w", err)
	}
	return nil
}

func (r *Repository) completeBudgets(ctx context.Context, rows []PlanningBudget) ([]domain.Budget, error) {
	if len(rows) == 0 {
		return nil, nil
	}
	ids := make([]uuid.UUID, len(rows))
	out := make([]domain.Budget, len(rows))
	byID := make(map[uuid.UUID]*domain.Budget, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
		out[i] = domain.Budget{ID: row.ID, CategoryID: row.CategoryAccountID, Rollover: row.Rollover, Currency: money.Currency(row.Currency)}
		byID[row.ID] = &out[i]
	}
	amounts, err := r.q.ListBudgetAmounts(ctx, ListBudgetAmountsParams{UserID: rows[0].UserID, BudgetIds: ids})
	if err != nil {
		return nil, fmt.Errorf("list budget amounts: %w", err)
	}
	for _, a := range amounts {
		b := byID[a.BudgetID]
		b.Amounts = append(b.Amounts, domain.BudgetAmount{EffectiveFrom: a.EffectiveFrom, Amount: a.Amount})
	}
	return out, nil
}

func (r *Repository) oneBudget(ctx context.Context, row PlanningBudget, err error) (domain.Budget, error) {
	if err != nil {
		return domain.Budget{}, notFound(err)
	}
	out, err := r.completeBudgets(ctx, []PlanningBudget{row})
	if err != nil {
		return domain.Budget{}, err
	}
	return out[0], nil
}

func (r *Repository) Budget(ctx context.Context, userID int64, id uuid.UUID) (domain.Budget, error) {
	row, err := r.q.GetBudget(ctx, GetBudgetParams{UserID: userID, ID: id})
	return r.oneBudget(ctx, row, err)
}

func (r *Repository) LockBudget(ctx context.Context, userID int64, id uuid.UUID) (domain.Budget, error) {
	row, err := r.q.LockBudget(ctx, LockBudgetParams{UserID: userID, ID: id})
	return r.oneBudget(ctx, row, err)
}

func (r *Repository) ListBudgets(ctx context.Context, userID int64, p page.Request[app.IDKey]) ([]domain.Budget, *app.IDKey, error) {
	after, limit := keyset(p)
	rows, err := r.q.ListBudgets(ctx, ListBudgetsParams{UserID: userID, AfterID: after, RowLimit: limit})
	if err != nil {
		return nil, nil, fmt.Errorf("list budgets: %w", err)
	}
	rows, next := trim(rows, p.Limit, func(b PlanningBudget) uuid.UUID { return b.ID })
	out, err := r.completeBudgets(ctx, rows)
	return out, next, err
}

func (r *Repository) InsertGoal(ctx context.Context, userID int64, g domain.Goal) (domain.Goal, error) {
	row, err := r.q.InsertGoal(ctx, InsertGoalParams{UserID: userID, Name: g.Name, Target: g.Target, Currency: string(g.Currency), DueOn: g.DueOn})
	if pe, ok := errors.AsType[*pgconn.PgError](err); ok && pe.Code == uniqueViolation {
		return domain.Goal{}, &domain.FieldError{Field: "name", Message: "is the name of another goal", Err: domain.ErrValidation}
	}
	if err != nil {
		return domain.Goal{}, fmt.Errorf("insert goal: %w", err)
	}
	if err := r.q.InsertGoalAccounts(ctx, InsertGoalAccountsParams{UserID: userID, GoalID: row.ID, AccountIds: g.AccountIDs}); err != nil {
		return domain.Goal{}, fmt.Errorf("insert goal accounts: %w", err)
	}
	return r.oneGoal(ctx, row, nil)
}

func (r *Repository) UpdateGoal(ctx context.Context, userID int64, g domain.Goal) (domain.Goal, error) {
	row, err := r.q.UpdateGoal(ctx, UpdateGoalParams{UserID: userID, ID: g.ID, Name: g.Name, Target: g.Target, Currency: string(g.Currency), DueOn: g.DueOn})
	if pe, ok := errors.AsType[*pgconn.PgError](err); ok && pe.Code == uniqueViolation {
		return domain.Goal{}, &domain.FieldError{Field: "name", Message: "is the name of another goal", Err: domain.ErrValidation}
	}
	if err != nil {
		return r.oneGoal(ctx, row, err)
	}
	if err := r.q.DeleteGoalAccounts(ctx, DeleteGoalAccountsParams{UserID: userID, GoalID: g.ID}); err != nil {
		return domain.Goal{}, fmt.Errorf("delete goal accounts: %w", err)
	}
	if err := r.q.InsertGoalAccounts(ctx, InsertGoalAccountsParams{UserID: userID, GoalID: g.ID, AccountIds: g.AccountIDs}); err != nil {
		return domain.Goal{}, fmt.Errorf("insert goal accounts: %w", err)
	}
	return r.oneGoal(ctx, row, nil)
}

func (r *Repository) DeleteGoal(ctx context.Context, userID int64, id uuid.UUID) error {
	n, err := r.q.DeleteGoal(ctx, DeleteGoalParams{UserID: userID, ID: id})
	if err != nil {
		return fmt.Errorf("delete goal: %w", err)
	}
	if n == 0 {
		return app.ErrNotFound
	}
	return nil
}

func (r *Repository) completeGoals(ctx context.Context, rows []PlanningGoal) ([]domain.Goal, error) {
	if len(rows) == 0 {
		return nil, nil
	}
	ids := make([]uuid.UUID, len(rows))
	out := make([]domain.Goal, len(rows))
	byID := make(map[uuid.UUID]*domain.Goal, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
		out[i] = domain.Goal{ID: row.ID, Name: row.Name, Target: row.Target, Currency: money.Currency(row.Currency), DueOn: row.DueOn}
		byID[row.ID] = &out[i]
	}
	accounts, err := r.q.ListGoalAccounts(ctx, ListGoalAccountsParams{UserID: rows[0].UserID, GoalIds: ids})
	if err != nil {
		return nil, fmt.Errorf("list goal accounts: %w", err)
	}
	for _, a := range accounts {
		g := byID[a.GoalID]
		g.AccountIDs = append(g.AccountIDs, a.AccountID)
	}
	return out, nil
}

func (r *Repository) oneGoal(ctx context.Context, row PlanningGoal, err error) (domain.Goal, error) {
	if err != nil {
		return domain.Goal{}, notFound(err)
	}
	out, err := r.completeGoals(ctx, []PlanningGoal{row})
	if err != nil {
		return domain.Goal{}, err
	}
	return out[0], nil
}

func (r *Repository) Goal(ctx context.Context, userID int64, id uuid.UUID) (domain.Goal, error) {
	row, err := r.q.GetGoal(ctx, GetGoalParams{UserID: userID, ID: id})
	return r.oneGoal(ctx, row, err)
}

func (r *Repository) ListGoals(ctx context.Context, userID int64, p page.Request[app.IDKey]) ([]domain.Goal, *app.IDKey, error) {
	after, limit := keyset(p)
	rows, err := r.q.ListGoals(ctx, ListGoalsParams{UserID: userID, AfterID: after, RowLimit: limit})
	if err != nil {
		return nil, nil, fmt.Errorf("list goals: %w", err)
	}
	rows, next := trim(rows, p.Limit, func(g PlanningGoal) uuid.UUID { return g.ID })
	out, err := r.completeGoals(ctx, rows)
	return out, next, err
}

func (r *Repository) MergeCategory(ctx context.Context, userID int64, from, into uuid.UUID) error {
	if err := r.q.DeleteMergedBudget(ctx, DeleteMergedBudgetParams{UserID: userID, FromID: from, IntoID: into}); err != nil {
		return err
	}
	if err := r.q.MoveMergedBudget(ctx, MoveMergedBudgetParams{UserID: userID, FromID: from, IntoID: into}); err != nil {
		return err
	}
	return r.q.MergeScheduleAccounts(ctx, MergeScheduleAccountsParams{UserID: userID, FromID: from, IntoID: into})
}

func (r *Repository) MergePayee(ctx context.Context, userID int64, from, into uuid.UUID) error {
	return r.q.MergeSchedulePayee(ctx, MergeSchedulePayeeParams{UserID: userID, FromID: uuid.NullUUID{UUID: from, Valid: true}, IntoID: uuid.NullUUID{UUID: into, Valid: true}})
}
