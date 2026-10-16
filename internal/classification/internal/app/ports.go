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

// Categorization methods (SC5).
const (
	MethodRule    = domain.MethodRule
	MethodHistory = domain.MethodHistory
	MethodSource  = "source"
	MethodManual  = "manual"
)

// PendingKey orders uncategorized records for RunRules.
type PendingKey struct {
	Date time.Time
	ID   uuid.UUID
}

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

	Categorization(ctx context.Context, userID int64, transactionID uuid.UUID) (Record, error)
	// UpsertCategorization writes rec unless the stored row has the same or a higher
	// version or is voided, and reports whether it wrote.
	UpsertCategorization(ctx context.Context, rec Record) (bool, error)
	MarkVoided(ctx context.Context, rec Record) error
	// DeleteCategorization removes the row of a transaction that lost its category postings at version.
	DeleteCategorization(ctx context.Context, userID int64, transactionID uuid.UUID, version int) error
	// PendingCategorizations returns up to limit uncategorized, non-voided transactions after
	// the key, and the key of the last one when more may follow.
	PendingCategorizations(ctx context.Context, userID int64, after *PendingKey, limit int) ([]uuid.UUID, *PendingKey, error)
	CountMethods(ctx context.Context, userID int64, from, to time.Time) (map[string]int, error)

	// CorrectedExamples returns up to limit corrected, non-voided transactions with the
	// match key and category, oldest first.
	CorrectedExamples(ctx context.Context, userID int64, matchKey string, categoryID uuid.UUID, limit int) ([]uuid.UUID, error)
	// UpsertSuggestion inserts s as pending, or replaces the examples of a pending
	// suggestion with the same fingerprint; a decided suggestion is left unchanged.
	UpsertSuggestion(ctx context.Context, s Suggestion) error
	ListSuggestions(ctx context.Context, userID int64, state string, p page.Request[SuggestionKey]) ([]Suggestion, *SuggestionKey, error)
	LockSuggestion(ctx context.Context, userID int64, id uuid.UUID) (Suggestion, error)
	DecideSuggestion(ctx context.Context, userID int64, id uuid.UUID, state string, ruleID uuid.UUID) (Suggestion, error)
}

// Account is a ledger account as classification reads it.
type Account struct {
	ID                      uuid.UUID
	Class, Kind, SystemRole string
	Instrument              money.Currency
	OpenedOn                time.Time
	ClosedOn                *time.Time
}

func (a Account) isCategory() bool { return isCategory(a.Class) }

func (a Account) isUncategorized() bool { return isUncategorized(a.SystemRole) }

func isCategory(class string) bool { return class == "income" || class == "expense" }

func isUncategorized(role string) bool {
	return role == "uncategorized_expense" || role == "uncategorized_income"
}

func (a Account) isBalance() bool { return a.Class == "asset" || a.Class == "liability" }

// FactPosting is a posting with the account attributes rules read.
type FactPosting struct {
	AccountID               uuid.UUID
	Class, Kind, SystemRole string
	Amount                  money.Money
	Installment             bool
}

func (p FactPosting) isCategory() bool { return isCategory(p.Class) }

func (p FactPosting) isUncategorized() bool { return isUncategorized(p.SystemRole) }

// TransactionFacts describes a ledger transaction (P5 amendments A17, A26).
type TransactionFacts struct {
	ID                          uuid.UUID
	Version                     int
	Date                        time.Time
	Description, RawDescription string
	PayeeID                     uuid.UUID
	Origin                      string
	Voided                      bool
	CategoryState               string
	Postings                    []FactPosting
}

// Categorization asks the ledger to categorize one transaction (P5 amendment A18).
type Categorization struct {
	TransactionID   uuid.UUID
	ExpectedVersion int
	Parts           []domain.Allocation // nil keeps the category postings
	PayeeID         *uuid.UUID
	AddTags         []string
	Method          string
	RuleID          uuid.UUID
}

// Ledger is the part of the ledger module that classification uses.
type Ledger interface {
	AccountFacts(ctx context.Context, userID int64) ([]Account, error)
	MissingPayees(ctx context.Context, userID int64, ids []uuid.UUID) ([]uuid.UUID, error)
	TransactionFacts(ctx context.Context, userID int64, ids []uuid.UUID) ([]TransactionFacts, error)
	LatestPayeeCategories(ctx context.Context, userID int64, payees []uuid.UUID) (map[domain.HistoryKey]uuid.UUID, error)
	// Categorize returns the error of each item; err applies none.
	Categorize(ctx context.Context, userID int64, cs []Categorization) (errs []error, err error)
	// Transfer reports false when the ledger refused the transfer for a business rule.
	Transfer(ctx context.Context, userID int64, t TransferRequest) (applied bool, err error)
}

// TransferRequest asks the ledger to turn a transaction into a transfer (P5b amendment A31).
type TransferRequest struct {
	TransactionID   uuid.UUID
	ExpectedVersion int
	AccountID       uuid.UUID
	RuleID          uuid.UUID
}
