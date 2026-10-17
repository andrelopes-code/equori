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
	// ErrOccurrenceClosed refuses a change to an occurrence in another state (A51, A52).
	ErrOccurrenceClosed = errors.New("the occurrence is not in a state that allows this change")
	// ErrTransactionInUse refuses a transaction that realizes another occurrence (I07).
	ErrTransactionInUse = errors.New("the transaction realizes another occurrence")
	// ErrPauseOverlap refuses a pause that overlaps another pause of the schedule (A52).
	ErrPauseOverlap = errors.New("the pause overlaps another pause of the schedule")
	// ErrScheduleEnded refuses a change dated on or after the schedule's end (A52).
	ErrScheduleEnded = errors.New("the schedule ends before this date")
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
	// TransactionFacts returns the user's transactions among ids; unknown ids are omitted.
	TransactionFacts(ctx context.Context, userID int64, ids []uuid.UUID) ([]domain.Transaction, error)
	// CategoryTotal sums the postings of a category subtree booked in [from, to), in minor
	// units of the base currency.
	CategoryTotal(ctx context.Context, userID int64, categoryID uuid.UUID, from, to time.Time) (int64, error)
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
	// SchedulesTouching returns the schedules whose account or counterpart is among accounts.
	SchedulesTouching(ctx context.Context, userID int64, accounts []uuid.UUID) ([]domain.Schedule, error)
	// OccurrenceByTransaction locks the occurrence the transaction realizes; ErrNotFound when none.
	OccurrenceByTransaction(ctx context.Context, userID int64, txID uuid.UUID) (domain.Occurrence, error)
	// ExpectedOccurrences locks the expected occurrences of schedules with expected date in [from, to].
	ExpectedOccurrences(ctx context.Context, userID int64, schedules []uuid.UUID, from, to time.Time) ([]domain.Occurrence, error)
	LockOccurrence(ctx context.Context, userID int64, id uuid.UUID) (domain.Occurrence, error)
	// Realize and Release change an expected or realized occurrence; ErrOccurrenceClosed when its
	// state changed meanwhile.
	Realize(ctx context.Context, userID int64, id, txID uuid.UUID, by string) (domain.Occurrence, error)
	Release(ctx context.Context, userID int64, id uuid.UUID) (domain.Occurrence, error)
	// Skip and Move change an expected occurrence; ErrOccurrenceClosed otherwise.
	Skip(ctx context.Context, userID int64, id uuid.UUID, reason string) (domain.Occurrence, error)
	Move(ctx context.Context, userID int64, id uuid.UUID, date time.Time) (domain.Occurrence, error)
	// DeleteExpected removes expected occurrences with expected date in [from, to]; moved ones
	// only with includeMoved.
	DeleteExpected(ctx context.Context, userID int64, scheduleID uuid.UUID, from, to time.Time, includeMoved bool) error
	InsertTerms(ctx context.Context, userID int64, scheduleID uuid.UUID, t domain.Terms) error
	// InsertPause returns ErrPauseOverlap when the pause overlaps another one.
	InsertPause(ctx context.Context, userID int64, scheduleID uuid.UUID, p domain.Pause) error
	SetEndsOn(ctx context.Context, userID int64, id uuid.UUID, d time.Time) error

	// InsertBudget stores b with its amounts; ErrBudgetExists when the category has one.
	InsertBudget(ctx context.Context, userID int64, b domain.Budget) (domain.Budget, error)
	InsertBudgetAmount(ctx context.Context, userID int64, budgetID uuid.UUID, a domain.BudgetAmount) error
	Budget(ctx context.Context, userID int64, id uuid.UUID) (domain.Budget, error)
	LockBudget(ctx context.Context, userID int64, id uuid.UUID) (domain.Budget, error)
	ListBudgets(ctx context.Context, userID int64, p page.Request[IDKey]) ([]domain.Budget, *IDKey, error)
}
