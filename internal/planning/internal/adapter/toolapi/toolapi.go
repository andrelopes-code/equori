// Package toolapi declares the planning module's tools for language models (ADR 012).
package toolapi

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Account is the part of a ledger account the tools name and price amounts with.
type Account struct {
	Name       string
	Instrument money.Currency
}

// Ledger is the part of the ledger module the tools read.
type Ledger interface {
	// Accounts returns the user's accounts and categories by ID.
	Accounts(ctx context.Context, userID int64) (map[uuid.UUID]Account, error)
	BaseCurrency(ctx context.Context, userID int64) (money.Currency, error)
}

func Tools(svc *app.Service, l Ledger, clk clock.Clock) []tool.Tool {
	return []tool.Tool{
		listSchedules(svc, l, clk), getBudgetsAndGoals(svc, l, clk), projectBalance(svc, l),
		manageSchedule(svc, l, clk), manageOccurrence(svc), manageBudgetOrGoal(svc, l, clk),
	}
}

func optionalID(s, field string) (uuid.UUID, error) {
	if s == "" {
		return uuid.Nil, nil
	}
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, tool.InvalidArgument(field, "is not a UUID")
	}
	return id, nil
}

// field is an optional input and whether the call gave it.
type field struct {
	name  string
	given bool
}

// required reports a field the action needs, and rejects one it does not use. Fields in
// optional are accepted and not checked.
func required(name string, fields []field, needed []string, optional ...string) error {
	for _, f := range fields {
		switch {
		case slices.Contains(optional, f.name):
		case slices.Contains(needed, f.name) && !f.given:
			return tool.InvalidArgument(f.name, "is required for "+name)
		case !slices.Contains(needed, f.name) && f.given:
			return tool.InvalidArgument(f.name, "is not used by "+name)
		}
	}
	return nil
}

func moneyOf(amount int64, currency money.Currency) (tool.Money, error) {
	m, err := money.New(amount, currency)
	if err != nil {
		return tool.Money{}, err
	}
	return tool.MoneyOf(m), nil
}

// unitOf is the zero amount that carries the currency and scale of an instrument.
func unitOf(currency money.Currency) (money.Money, error) { return money.New(0, currency) }

const monthLayout = "2006-01"

// parseMonth reads YYYY-MM as the first day of the month; an empty s returns def.
func parseMonth(name, s string, def time.Time) (time.Time, error) {
	if s == "" {
		return def, nil
	}
	m, err := time.Parse(monthLayout, s)
	if err != nil {
		return time.Time{}, tool.InvalidArgument(name, "must be written YYYY-MM")
	}
	return m, nil
}

func firstOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

func accountName(accounts map[uuid.UUID]Account, id uuid.UUID) string { return accounts[id].Name }

// allSchedules reads every schedule of the user.
func allSchedules(ctx context.Context, svc *app.Service, userID int64) ([]domain.Schedule, error) {
	var out []domain.Schedule
	r := page.Request[app.IDKey]{Limit: page.MaxLimit}
	for {
		ss, next, err := svc.ListSchedules(ctx, userID, r)
		if err != nil {
			return nil, err
		}
		out = append(out, ss...)
		if next == nil {
			return out, nil
		}
		r.After = next
	}
}
