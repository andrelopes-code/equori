// Package app runs the Planning use cases over its ports.
package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

var (
	ErrNotFound = errors.New("not found")
	// ErrCurrencyUnsupported refuses an account outside the base currency (P7 amendment A47).
	ErrCurrencyUnsupported = errors.New("only the base currency is supported")
)

// CurrencyError names the field whose account is outside the base currency.
type CurrencyError struct{ Field string }

func (e *CurrencyError) Error() string { return e.Field + ": " + ErrCurrencyUnsupported.Error() }
func (e *CurrencyError) Unwrap() error { return ErrCurrencyUnsupported }

// Account is the part of a ledger account Planning checks.
type Account struct {
	ID          uuid.UUID
	Class, Kind string
	Instrument  money.Currency
}

// Ledger is the part of the ledger module Planning reads (ADR 002).
type Ledger interface {
	AccountFacts(ctx context.Context, userID int64) ([]Account, error)
	MissingPayees(ctx context.Context, userID int64, ids []uuid.UUID) ([]uuid.UUID, error)
	BaseCurrency(ctx context.Context, userID int64) (money.Currency, error)
}

// Calendar returns the holiday dates of a calendar in a year.
type Calendar interface {
	Holidays(ctx context.Context, name string, year int) ([]time.Time, error)
}

// IDKey is the sort key of lists in creation order.
type IDKey struct {
	ID uuid.UUID `json:"i"`
}

// ScheduleRef names a schedule across users.
type ScheduleRef struct {
	UserID int64
	ID     uuid.UUID
}

type Repository interface {
	InTx(ctx context.Context, fn func(Repository) error) error
	// InsertSchedule stores s with its terms and returns it with its id.
	InsertSchedule(ctx context.Context, userID int64, s domain.Schedule) (domain.Schedule, error)
	Schedule(ctx context.Context, userID int64, id uuid.UUID) (domain.Schedule, error)
	// LockSchedule reads the schedule for update.
	LockSchedule(ctx context.Context, userID int64, id uuid.UUID) (domain.Schedule, error)
	ListSchedules(ctx context.Context, userID int64, p page.Request[IDKey]) ([]domain.Schedule, *IDKey, error)
	Schedules(ctx context.Context, userID int64) ([]domain.Schedule, error)
	SchedulesBehind(ctx context.Context, horizon time.Time) ([]ScheduleRef, error)
	SetGeneratedUntil(ctx context.Context, userID int64, id uuid.UUID, d time.Time) error
	InsertOccurrences(ctx context.Context, userID int64, scheduleID uuid.UUID, ps []domain.Planned) error
	// Occurrences returns the occurrences with expected date in [from, to]; scheduleID uuid.Nil
	// means every schedule.
	Occurrences(ctx context.Context, userID int64, from, to time.Time, scheduleID uuid.UUID) ([]domain.Occurrence, error)
}
