// Package app implements the classification use cases.
package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

var (
	ErrNotFound    = errors.New("not found")
	ErrAliasExists = errors.New("an alias with this pattern and match type exists")
)

// RuleKey and AliasKey are the cursors of the rule and alias lists.
type RuleKey struct {
	Priority int `json:"rp"`
}

type AliasKey struct {
	ID uuid.UUID `json:"ai"`
}

// Repository returns ErrNotFound for missing rows.
type Repository interface {
	InTx(ctx context.Context, fn func(Repository) error) error
	ListRules(ctx context.Context, userID int64, p page.Request[RuleKey]) ([]domain.Rule, *RuleKey, error)
	// EnabledRules returns the enabled rules by priority.
	EnabledRules(ctx context.Context, userID int64) ([]domain.Rule, error)
	// LockRuleIDs returns every rule id by priority and locks the rules.
	LockRuleIDs(ctx context.Context, userID int64) ([]uuid.UUID, error)
	Rule(ctx context.Context, userID int64, id uuid.UUID) (domain.Rule, error)
	// InsertRule stores r at the last priority.
	InsertRule(ctx context.Context, userID int64, r domain.Rule) (domain.Rule, error)
	UpdateRule(ctx context.Context, userID int64, r domain.Rule) (domain.Rule, error)
	DeleteRule(ctx context.Context, userID int64, id uuid.UUID) error
	// SetPriorities gives ids the priorities 1..n in order.
	SetPriorities(ctx context.Context, userID int64, ids []uuid.UUID) error

	ListAliases(ctx context.Context, userID int64, p page.Request[AliasKey]) ([]domain.Alias, *AliasKey, error)
	Aliases(ctx context.Context, userID int64) ([]domain.Alias, error)
	Alias(ctx context.Context, userID int64, id uuid.UUID) (domain.Alias, error)
	// InsertAlias and UpdateAlias return ErrAliasExists for a repeated pattern and match type.
	InsertAlias(ctx context.Context, userID int64, a domain.Alias) (domain.Alias, error)
	UpdateAlias(ctx context.Context, userID int64, a domain.Alias) (domain.Alias, error)
	DeleteAlias(ctx context.Context, userID int64, id uuid.UUID) error
}

// Account is a ledger account as classification reads it.
type Account struct {
	ID                      uuid.UUID
	Class, Kind, SystemRole string
	Instrument              money.Currency
	OpenedOn                time.Time
	ClosedOn                *time.Time
}

func (a Account) isCategory() bool {
	return (a.Class == "income" || a.Class == "expense") && a.SystemRole != "uncategorized_expense" && a.SystemRole != "uncategorized_income"
}

func (a Account) isBalance() bool { return a.Class == "asset" || a.Class == "liability" }

// Ledger is the part of the ledger module that classification uses.
type Ledger interface {
	AccountFacts(ctx context.Context, userID int64) ([]Account, error)
	MissingPayees(ctx context.Context, userID int64, ids []uuid.UUID) ([]uuid.UUID, error)
}
