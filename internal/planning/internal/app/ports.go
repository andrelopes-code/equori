// Package app runs the Planning use cases over its ports.
package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

var (
	ErrNotFound = errors.New("not found")
	// ErrCurrencyUnsupported refuses an account whose instrument the operation cannot take (P8 amendment A72).
	ErrCurrencyUnsupported = errors.New("the account's instrument is not supported here")
	// ErrOccurrenceClosed refuses a change to an occurrence in another state (A51, A52).
	ErrOccurrenceClosed = errors.New("the occurrence is not in a state that allows this change")
	// ErrTransactionInUse refuses a transaction that realizes another occurrence (I07).
	ErrTransactionInUse = errors.New("the transaction realizes another occurrence")
	// ErrPauseOverlap refuses a pause that overlaps another pause of the schedule (A52).
	ErrPauseOverlap = errors.New("the pause overlaps another pause of the schedule")
	// ErrScheduleEnded refuses a change dated on or after the schedule's end (A52).
	ErrScheduleEnded = errors.New("the schedule ends before this date")
)

// CurrencyError names the field whose account has an unsupported instrument.
type CurrencyError struct{ Field string }

func (e *CurrencyError) Error() string { return e.Field + ": " + ErrCurrencyUnsupported.Error() }
func (e *CurrencyError) Unwrap() error { return ErrCurrencyUnsupported }

var (
	// ErrPriceMissing: no stored price values an amount in the requested currency (P8 A61).
	ErrPriceMissing = errors.New("price missing")
	// ErrMixedInstruments: the account's sub-accounts hold several instruments (P8 A63).
	ErrMixedInstruments = errors.New("the account and its sub-accounts hold more than one instrument")
)

type Price struct {
	Instrument, Quote money.Currency
	Date              time.Time
	Value             money.Rate
	Source            string
}

// Prices values amounts with stored prices (Market data); Convert returns an error
// wrapping ErrPriceMissing when no price path exists.
type Prices interface {
	Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (money.Money, []Price, error)
}

// Returns gives the money-weighted return of accounts taken as one tree over the last 12 months
// (Portfolio, investments design 4.4); ok is false when there is too little history or no flow.
type Returns interface {
	TrailingReturn(ctx context.Context, userID int64, accountIDs []uuid.UUID, today time.Time, in money.Currency) (bp, months int, ok bool, err error)
}

// Account is the part of a ledger account Planning checks.
type Account struct {
	ID, ParentID uuid.UUID
	Class, Kind  string
	Instrument   money.Currency
}

// Valuation is the value of an account tree in one currency, the prices it used and the value
// of each instrument held.
type Valuation struct {
	Value  money.Money
	Prices []Price
	Parts  []ValuedPart
}

// ValuedPart is a quantity of one instrument held in a goal account and its value.
type ValuedPart struct {
	AccountID  uuid.UUID
	Instrument money.Currency
	Quantity   money.Money
	Value      money.Money
}

// Ledger is the part of the ledger module Planning reads (ADR 002).
type Ledger interface {
	AccountFacts(ctx context.Context, userID int64) ([]Account, error)
	MissingPayees(ctx context.Context, userID int64, ids []uuid.UUID) ([]uuid.UUID, error)
	BaseCurrency(ctx context.Context, userID int64) (money.Currency, error)
	// TransactionFacts returns the user's transactions among ids; unknown ids are omitted.
	TransactionFacts(ctx context.Context, userID int64, ids []uuid.UUID) ([]domain.Transaction, error)
	// AccountTransactionsBetween returns the non-voided transactions with a posting on the
	// account dated in [from, to], by date.
	AccountTransactionsBetween(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]uuid.UUID, error)
	// CategoryTotal sums the postings of a category subtree booked in [from, to), in minor
	// units of the base currency.
	CategoryTotal(ctx context.Context, userID int64, categoryID uuid.UUID, from, to time.Time) (int64, error)
	// CategoryMonthlyTotals is CategoryTotal for each month in [from, to), keyed by its first day.
	CategoryMonthlyTotals(ctx context.Context, userID int64, categoryID uuid.UUID, from, to time.Time) (map[time.Time]int64, error)
	// Balance is the booked balance of an account at the end of date, in its instrument.
	Balance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time) (money.Money, error)
	// ValuedBalance values the account and its sub-accounts in currency in; the error wraps
	// ErrPriceMissing when no stored price values an instrument.
	ValuedBalance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, in money.Currency) (Valuation, error)
	// Commitment sums the installments of a card billed on the statement of month while it is open.
	Commitment(ctx context.Context, userID int64, cardID uuid.UUID, month time.Time) (int64, error)
}

// ErrUnknownCalendar is returned by Calendar.Holidays for an id no calendar answers to.
var ErrUnknownCalendar = errors.New("unknown calendar")

// Calendar returns the holiday dates of a calendar in a year.
type Calendar interface {
	Holidays(ctx context.Context, name string, year int) ([]time.Time, error)
	DefaultCalendar(region string) string
}

// Profiles gives the language and region of a user (identity).
type Profiles interface {
	Profile(ctx context.Context, userID int64) (locale.Locale, error)
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
	// MergeCategory moves budgets and schedules from one category to another (A75).
	MergeCategory(ctx context.Context, userID int64, from, into uuid.UUID) error
	// MergePayee moves the schedules of a payee to another (A82).
	MergePayee(ctx context.Context, userID int64, from, into uuid.UUID) error
	InTx(ctx context.Context, fn func(Repository) error) error
	// InsertSchedule stores s with its terms and returns it with its id.
	InsertSchedule(ctx context.Context, userID int64, s domain.Schedule) (domain.Schedule, error)
	Schedule(ctx context.Context, userID int64, id uuid.UUID) (domain.Schedule, error)
	// LockSchedule reads the schedule for update.
	LockSchedule(ctx context.Context, userID int64, id uuid.UUID) (domain.Schedule, error)
	ListSchedules(ctx context.Context, userID int64, p page.Request[IDKey]) ([]domain.Schedule, *IDKey, error)
	Schedules(ctx context.Context, userID int64) ([]domain.Schedule, error)
	SchedulesBehind(ctx context.Context, horizon time.Time) ([]ScheduleRef, error)
	// ScheduleRefs returns every schedule across users.
	ScheduleRefs(ctx context.Context) ([]ScheduleRef, error)
	SetGeneratedUntil(ctx context.Context, userID int64, id uuid.UUID, d time.Time) error
	InsertOccurrences(ctx context.Context, userID int64, scheduleID uuid.UUID, ps []domain.Planned) error
	// Occurrences returns the occurrences with expected date in [from, to]; scheduleID uuid.Nil
	// means every schedule.
	Occurrences(ctx context.Context, userID int64, from, to time.Time, scheduleID uuid.UUID) ([]domain.Occurrence, error)
	OccurrencesOfTransaction(ctx context.Context, userID int64, txID uuid.UUID) ([]domain.Occurrence, error)
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
	// Release with decline also records the transaction as declined by the occurrence.
	Release(ctx context.Context, userID int64, id uuid.UUID, decline bool) (domain.Occurrence, error)
	// Skip and Move change an expected occurrence; ErrOccurrenceClosed otherwise.
	Skip(ctx context.Context, userID int64, id uuid.UUID, reason string) (domain.Occurrence, error)
	Move(ctx context.Context, userID int64, id uuid.UUID, date time.Time) (domain.Occurrence, error)
	// DeleteExpected removes expected occurrences with expected date in [from, to]; moved ones
	// only with includeMoved. It returns the dates removed.
	DeleteExpected(ctx context.Context, userID int64, scheduleID uuid.UUID, from, to time.Time, includeMoved bool) ([]time.Time, error)
	// KeptOccurrences returns the realized, skipped and moved occurrences generated on or after from.
	KeptOccurrences(ctx context.Context, userID int64, scheduleID uuid.UUID, from time.Time) ([]domain.Occurrence, error)
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
	// DeleteBudget removes the budget with its amounts; ErrNotFound when it is not the user's.
	DeleteBudget(ctx context.Context, userID int64, id uuid.UUID) error

	// InsertGoal stores g with its accounts; a used name is a field error on name.
	InsertGoal(ctx context.Context, userID int64, g domain.Goal) (domain.Goal, error)
	Goal(ctx context.Context, userID int64, id uuid.UUID) (domain.Goal, error)
	ListGoals(ctx context.Context, userID int64, p page.Request[IDKey]) ([]domain.Goal, *IDKey, error)
	// UpdateGoal replaces the fields and the accounts of g.ID; ErrNotFound when it is not the user's.
	UpdateGoal(ctx context.Context, userID int64, g domain.Goal) (domain.Goal, error)
	// DeleteGoal removes the goal with its accounts; ErrNotFound when it is not the user's.
	DeleteGoal(ctx context.Context, userID int64, id uuid.UUID) error
}
