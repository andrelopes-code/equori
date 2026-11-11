package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
)

func (r *Repository) InsertOccurrences(ctx context.Context, booksID int64, scheduleID uuid.UUID, ps []domain.Planned) error {
	if len(ps) == 0 {
		return nil
	}

	arg := InsertOccurrencesParams{BooksID: booksID, ScheduleID: scheduleID}
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

func (r *Repository) Occurrences(ctx context.Context, booksID int64, from, to time.Time, scheduleID uuid.UUID) ([]domain.Occurrence, error) {
	rows, err := r.q.ListOccurrences(ctx, ListOccurrencesParams{BooksID: booksID, FromDate: from, ToDate: to, ScheduleID: nullUUID(scheduleID)})
	if err != nil {
		return nil, fmt.Errorf("list occurrences: %w", err)
	}

	out := make([]domain.Occurrence, len(rows))
	for i, row := range rows {
		out[i] = toOccurrence(row)
	}

	return out, nil
}

func (r *Repository) OccurrencesOfTransaction(ctx context.Context, booksID int64, txID uuid.UUID) ([]domain.Occurrence, error) {
	rows, err := r.q.ListOccurrencesOfTransaction(ctx, ListOccurrencesOfTransactionParams{BooksID: booksID, TransactionID: nullUUID(txID)})
	if err != nil {
		return nil, fmt.Errorf("list occurrences of a transaction: %w", err)
	}

	out := make([]domain.Occurrence, len(rows))
	for i, row := range rows {
		out[i] = toOccurrence(row)
	}

	return out, nil
}

func (r *Repository) SchedulesTouching(ctx context.Context, booksID int64, accounts []uuid.UUID) ([]domain.Schedule, error) {
	rows, err := r.q.SchedulesTouching(ctx, SchedulesTouchingParams{BooksID: booksID, AccountIds: accounts})
	if err != nil {
		return nil, fmt.Errorf("list schedules of accounts: %w", err)
	}

	return r.complete(ctx, rows)
}

func (r *Repository) OccurrenceByTransaction(ctx context.Context, booksID int64, txID uuid.UUID) (domain.Occurrence, error) {
	row, err := r.q.OccurrenceByTransaction(ctx, OccurrenceByTransactionParams{BooksID: booksID, TransactionID: nullUUID(txID)})
	if err != nil {
		return domain.Occurrence{}, notFound(err)
	}

	return toOccurrence(row), nil
}

func (r *Repository) ExpectedOccurrences(ctx context.Context, booksID int64, schedules []uuid.UUID, from, to time.Time) ([]domain.Occurrence, error) {
	rows, err := r.q.ExpectedOccurrences(ctx, ExpectedOccurrencesParams{BooksID: booksID, ScheduleIds: schedules, FromDate: from, ToDate: to})
	if err != nil {
		return nil, fmt.Errorf("list expected occurrences: %w", err)
	}

	out := make([]domain.Occurrence, len(rows))
	for i, row := range rows {
		out[i] = toOccurrence(row)
	}

	return out, nil
}

func (r *Repository) LockOccurrence(ctx context.Context, booksID int64, id uuid.UUID) (domain.Occurrence, error) {
	row, err := r.q.LockOccurrence(ctx, LockOccurrenceParams{BooksID: booksID, ID: id})
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

func (r *Repository) Realize(ctx context.Context, booksID int64, id, txID uuid.UUID, by string) (domain.Occurrence, error) {
	row, err := r.q.RealizeOccurrence(ctx, RealizeOccurrenceParams{BooksID: booksID, ID: id, TransactionID: nullUUID(txID), RealizedBy: &by})
	// I07: another realization of the transaction committed after this one checked for it.
	if pe, ok := errors.AsType[*pgconn.PgError](err); ok && pe.Code == uniqueViolation {
		return domain.Occurrence{}, app.ErrTransactionInUse
	}

	if err != nil {
		return domain.Occurrence{}, closed(err)
	}

	return toOccurrence(row), nil
}

func (r *Repository) Release(ctx context.Context, booksID int64, id uuid.UUID, decline bool) (domain.Occurrence, error) {
	row, err := r.q.ReleaseOccurrence(ctx, ReleaseOccurrenceParams{BooksID: booksID, ID: id, Decline: decline})
	if err != nil {
		return domain.Occurrence{}, closed(err)
	}

	return toOccurrence(row), nil
}

func (r *Repository) Skip(ctx context.Context, booksID int64, id uuid.UUID, reason string) (domain.Occurrence, error) {
	var p *string
	if reason != "" {
		p = &reason
	}

	row, err := r.q.SkipOccurrence(ctx, SkipOccurrenceParams{BooksID: booksID, ID: id, SkipReason: p})
	if err != nil {
		return domain.Occurrence{}, closed(err)
	}

	return toOccurrence(row), nil
}

func (r *Repository) Reopen(ctx context.Context, booksID int64, id uuid.UUID) (domain.Occurrence, error) {
	row, err := r.q.ReopenOccurrence(ctx, ReopenOccurrenceParams{BooksID: booksID, ID: id})
	if err != nil {
		return domain.Occurrence{}, closed(err)
	}

	return toOccurrence(row), nil
}

func (r *Repository) Move(ctx context.Context, booksID int64, id uuid.UUID, date time.Time) (domain.Occurrence, error) {
	row, err := r.q.MoveOccurrence(ctx, MoveOccurrenceParams{BooksID: booksID, ID: id, ExpectedOn: date})
	if err != nil {
		return domain.Occurrence{}, closed(err)
	}

	return toOccurrence(row), nil
}

func (r *Repository) DeleteExpected(ctx context.Context, booksID int64, scheduleID uuid.UUID, from, to time.Time, includeMoved bool) ([]time.Time, error) {
	removed, err := r.q.DeleteExpected(ctx, DeleteExpectedParams{BooksID: booksID, ScheduleID: scheduleID, FromDate: from, ToDate: to, IncludeMoved: includeMoved})
	if err != nil {
		return nil, fmt.Errorf("delete expected occurrences: %w", err)
	}

	return removed, nil
}

func (r *Repository) KeptOccurrences(ctx context.Context, booksID int64, scheduleID uuid.UUID, from time.Time) ([]domain.Occurrence, error) {
	rows, err := r.q.KeptOccurrences(ctx, KeptOccurrencesParams{BooksID: booksID, ScheduleID: scheduleID, FromDate: &from})
	if err != nil {
		return nil, fmt.Errorf("list kept occurrences: %w", err)
	}

	out := make([]domain.Occurrence, len(rows))
	for i, row := range rows {
		out[i] = toOccurrence(row)
	}

	return out, nil
}
