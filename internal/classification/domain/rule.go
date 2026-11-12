package domain

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

type Field string

const (
	FieldDescription    Field = "description"
	FieldRawDescription Field = "raw_description"
	FieldPayee          Field = "payee"
	FieldAmount         Field = "amount"
	FieldAbsoluteAmount Field = "absolute_amount"
	FieldAccount        Field = "account"
	FieldAccountKind    Field = "account_kind"
	FieldSource         Field = "source"
	FieldWeekday        Field = "weekday"
	FieldDayOfMonth     Field = "day_of_month"
	FieldInstallment    Field = "installment"
)

type Operator string

const (
	OpEquals      Operator = "equals"
	OpContains    Operator = "contains"
	OpStartsWith  Operator = "starts_with"
	OpRegex       Operator = "regex"
	OpBetween     Operator = "between"
	OpGreaterThan Operator = "greater_than"
	OpLessThan    Operator = "less_than"
	OpInList      Operator = "in_list"
)

type ActionType string

const (
	ActionSetCategory ActionType = "set_category"
	ActionSetPayee    ActionType = "set_payee"
	ActionAddTags     ActionType = "add_tags"
	ActionSplit       ActionType = "split"
	// ActionTransfer and ActionMarkReimbursable replace the category side with a posting on
	// another of the owner's accounts (P5b amendment A31).
	ActionTransfer         ActionType = "transfer"
	ActionMarkReimbursable ActionType = "mark_reimbursable"
)

// categoryActions decide the category; a rule has at most one of them.
var categoryActions = []ActionType{
	ActionSetCategory,
	ActionSplit,
	ActionTransfer,
	ActionMarkReimbursable,
}

const (
	maxNameLength  = 120
	maxTextValue   = 200
	maxListValues  = 100
	maxConditions  = 20
	maxActions     = 10
	maxTags        = 10
	minSplitParts  = 2
	maxSplitParts  = 10
	basisPointsAll = 10000
)

var (
	accountKinds = []string{
		"checking",
		"savings",
		"cash",
		"wallet",
		"benefit",
		"reserve",
		"brokerage",
		"receivable",
		"credit_card",
		"loan",
		"payable",
	}
	sources  = []string{"manual", "import", "schedule"}
	weekdays = []string{
		"sunday",
		"monday",
		"tuesday",
		"wednesday",
		"thursday",
		"friday",
		"saturday",
	}
	tagPattern = regexp.MustCompile(`^[\p{Ll}\p{Lm}\p{Lo}\p{N}][\p{Ll}\p{Lm}\p{Lo}\p{N}-]{0,59}$`)
)

// Condition is one test on a subject (P5 amendment A21). The value lives in the member
// that the field's type selects.
type Condition struct {
	Field    Field
	Operator Operator
	Text     []string // text fields, account kinds, sources, weekdays
	Money    []money.Money
	IDs      []uuid.UUID // payees, accounts
	Ints     []int       // days of month
	Bool     bool

	normalized []string
	re         *regexp.Regexp
}

// Part is one share of a split action: exactly one of Percent (basis points), Amount and
// Remainder is set.
type Part struct {
	CategoryID uuid.UUID
	Percent    int
	Amount     *money.Money
	Remainder  bool
}

type Action struct {
	Type       ActionType
	CategoryID uuid.UUID
	PayeeID    uuid.UUID
	AccountID  uuid.UUID
	Tags       []string
	Parts      []Part
}

type Rule struct {
	ID             uuid.UUID
	Name           string
	Priority       int
	Enabled        bool
	StopProcessing bool
	Conditions     []Condition
	Actions        []Action
}

// NewRule validates the shape of r and compiles its patterns. References to categories
// and payees are checked by the caller against the ledger.
func NewRule(r Rule) (Rule, error) {
	r.Name = strings.TrimSpace(r.Name)
	if n := utf8.RuneCountInString(r.Name); n == 0 || n > maxNameLength {
		return Rule{}, invalid("name", fmt.Sprintf("must have 1 to %d characters", maxNameLength))
	}

	if len(r.Conditions) == 0 || len(r.Conditions) > maxConditions {
		return Rule{}, invalid(
			"conditions",
			fmt.Sprintf("must have 1 to %d conditions", maxConditions),
		)
	}

	conditions := make([]Condition, len(r.Conditions))
	for i, c := range r.Conditions {
		checked, err := checkCondition(fmt.Sprintf("conditions[%d]", i), c)
		if err != nil {
			return Rule{}, err
		}

		conditions[i] = checked
	}

	r.Conditions = conditions
	if len(r.Actions) == 0 || len(r.Actions) > maxActions {
		return Rule{}, invalid("actions", fmt.Sprintf("must have 1 to %d actions", maxActions))
	}

	seen := map[ActionType]bool{}

	deciders := 0
	for i, a := range r.Actions {
		field := fmt.Sprintf("actions[%d]", i)

		if slices.Contains(categoryActions, a.Type) {
			deciders++
		}

		if seen[a.Type] || deciders > 1 {
			return Rule{}, invalid(
				field+".type",
				"repeats an action or combines two of set_category, split, transfer and mark_reimbursable",
			)
		}

		seen[a.Type] = true

		checked, err := checkAction(field, a)
		if err != nil {
			return Rule{}, err
		}

		r.Actions[i] = checked
	}

	return r, nil
}
