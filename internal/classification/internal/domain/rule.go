package domain

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
	"time"
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
var categoryActions = []ActionType{ActionSetCategory, ActionSplit, ActionTransfer, ActionMarkReimbursable}

const (
	MethodRule    = "rule"
	MethodSource  = "source"
	MethodHistory = "history"

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
	accountKinds = []string{"checking", "savings", "cash", "wallet", "benefit", "reserve", "brokerage", "receivable", "credit_card", "loan", "payable"}
	sources      = []string{"manual", "import", "schedule"}
	weekdays     = []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}
	tagPattern   = regexp.MustCompile(`^[\p{Ll}\p{Lm}\p{Lo}\p{N}][\p{Ll}\p{Lm}\p{Lo}\p{N}-]{0,59}$`)
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
		return Rule{}, invalid("conditions", fmt.Sprintf("must have 1 to %d conditions", maxConditions))
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
			return Rule{}, invalid(field+".type", "repeats an action or combines two of set_category, split, transfer and mark_reimbursable")
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

func checkCondition(field string, c Condition) (Condition, error) {
	value := field + ".value"
	operators, count := conditionShape(c.Field)
	if operators == nil {
		return Condition{}, invalid(field+".field", "is not a known field")
	}
	if !slices.Contains(operators, c.Operator) {
		return Condition{}, invalid(field+".operator", fmt.Sprintf("is not allowed for %s", c.Field))
	}
	want := 1
	switch c.Operator {
	case OpBetween:
		want = 2
	case OpInList:
		want = -1
	}
	if n := count(c); (want > 0 && n != want) || (want < 0 && (n == 0 || n > maxListValues)) {
		return Condition{}, invalid(value, valueCountMessage(want))
	}
	switch c.Field {
	case FieldDescription, FieldRawDescription:
		c.normalized = make([]string, len(c.Text))
		for i, t := range c.Text {
			if n := utf8.RuneCountInString(t); n == 0 || n > maxTextValue {
				return Condition{}, invalid(value, fmt.Sprintf("must have 1 to %d characters", maxTextValue))
			}
			c.normalized[i] = Normalize(t)
		}
		if c.Operator == OpRegex {
			re, err := regexp.Compile(c.Text[0])
			if err != nil {
				return Condition{}, invalid(value, "is not a valid RE2 pattern")
			}
			c.re = re
		}
	case FieldAccountKind, FieldSource, FieldWeekday:
		allowed := map[Field][]string{FieldAccountKind: accountKinds, FieldSource: sources, FieldWeekday: weekdays}[c.Field]
		for _, t := range c.Text {
			if !slices.Contains(allowed, t) {
				return Condition{}, invalid(value, "must be one of "+strings.Join(allowed, ", "))
			}
		}
	case FieldPayee, FieldAccount:
		if slices.Contains(c.IDs, uuid.Nil) {
			return Condition{}, invalid(value, "must be an id")
		}
	case FieldAmount, FieldAbsoluteAmount:
		for _, m := range c.Money {
			if m.Currency() != c.Money[0].Currency() {
				return Condition{}, invalid(value, "must use one currency")
			}
			if c.Field == FieldAbsoluteAmount && m.IsNegative() {
				return Condition{}, invalid(value, "must not be negative")
			}
		}
		if c.Operator == OpBetween && c.Money[0].Amount() > c.Money[1].Amount() {
			return Condition{}, invalid(value, "must list the minimum first")
		}
	case FieldDayOfMonth:
		for _, d := range c.Ints {
			if d < 1 || d > 31 {
				return Condition{}, invalid(value, "must be between 1 and 31")
			}
		}
		if c.Operator == OpBetween && c.Ints[0] > c.Ints[1] {
			return Condition{}, invalid(value, "must list the minimum first")
		}
	}
	return c, nil
}

// conditionShape returns the operators of a field and the number of values a condition holds.
func conditionShape(f Field) ([]Operator, func(Condition) int) {
	text := func(c Condition) int { return len(c.Text) }
	switch f {
	case FieldDescription, FieldRawDescription:
		return []Operator{OpEquals, OpContains, OpStartsWith, OpRegex, OpInList}, text
	case FieldPayee, FieldAccount:
		return []Operator{OpEquals, OpInList}, func(c Condition) int { return len(c.IDs) }
	case FieldAmount, FieldAbsoluteAmount:
		return []Operator{OpEquals, OpGreaterThan, OpLessThan, OpBetween}, func(c Condition) int { return len(c.Money) }
	case FieldAccountKind, FieldSource, FieldWeekday:
		return []Operator{OpEquals, OpInList}, text
	case FieldDayOfMonth:
		return []Operator{OpEquals, OpGreaterThan, OpLessThan, OpBetween, OpInList}, func(c Condition) int { return len(c.Ints) }
	case FieldInstallment:
		return []Operator{OpEquals}, func(Condition) int { return 1 }
	}
	return nil, nil
}

func valueCountMessage(want int) string {
	switch want {
	case 1:
		return "must be a single value"
	case 2:
		return "must be a minimum and a maximum"
	}
	return fmt.Sprintf("must be a list of 1 to %d values", maxListValues)
}

func checkAction(field string, a Action) (Action, error) {
	switch a.Type {
	case ActionSetCategory:
		if a.CategoryID == uuid.Nil {
			return Action{}, invalid(field+".category_id", "is required")
		}
	case ActionSetPayee:
		if a.PayeeID == uuid.Nil {
			return Action{}, invalid(field+".payee_id", "is required")
		}
	case ActionAddTags:
		if len(a.Tags) == 0 || len(a.Tags) > maxTags {
			return Action{}, invalid(field+".tags", fmt.Sprintf("must have 1 to %d tags", maxTags))
		}
		for i, t := range a.Tags {
			if !tagPattern.MatchString(t) {
				return Action{}, invalid(fmt.Sprintf("%s.tags[%d]", field, i), "must use lowercase letters, digits and hyphens, up to 60 characters")
			}
		}
	case ActionSplit:
		return a, checkParts(field+".parts", a.Parts)
	case ActionTransfer, ActionMarkReimbursable:
		if a.AccountID == uuid.Nil {
			return Action{}, invalid(field+".account_id", "is required")
		}
	default:
		return Action{}, invalid(field+".type", "is not a known action")
	}
	return a, nil
}

func checkParts(field string, parts []Part) error {
	if len(parts) < minSplitParts || len(parts) > maxSplitParts {
		return invalid(field, fmt.Sprintf("must have %d to %d parts", minSplitParts, maxSplitParts))
	}
	remainders, percent := 0, 0
	var currency money.Currency
	for i, p := range parts {
		pf := fmt.Sprintf("%s[%d]", field, i)
		if p.CategoryID == uuid.Nil {
			return invalid(pf+".category_id", "is required")
		}
		shares := 0
		if p.Percent != 0 {
			shares++
			if p.Percent < 1 || p.Percent >= basisPointsAll {
				return invalid(pf+".percent", "must be between 1 and 9999 basis points")
			}
			percent += p.Percent
		}
		if p.Amount != nil {
			shares++
			if p.Amount.IsNegative() || p.Amount.IsZero() {
				return invalid(pf+".amount", "must be positive")
			}
			if currency != "" && p.Amount.Currency() != currency {
				return invalid(pf+".amount", "must use one currency")
			}
			currency = p.Amount.Currency()
		}
		if p.Remainder {
			shares++
			remainders++
		}
		if shares != 1 {
			return invalid(pf, "must have exactly one of percent, amount and remainder")
		}
	}
	if remainders != 1 {
		return invalid(field, "must have exactly one remainder part")
	}
	if percent >= basisPointsAll {
		return invalid(field, "percent parts must sum to less than 10000 basis points")
	}
	return nil
}

// Subject is what rules test: a transaction or an import line (P5 amendment A21).
type Subject struct {
	Date           time.Time
	Description    string
	RawDescription string
	PayeeID        uuid.UUID
	// Amount is the negated sum of the category postings: an expense is negative.
	Amount       money.Money
	Accounts     []uuid.UUID // balance-sheet accounts
	AccountKinds []string
	Source       string
	Installment  bool
	// Class is the class of the uncategorized posting: "expense" or "income".
	Class string
	// SourceCategory is the owner's category for the aggregator's category of the line
	// (P6 amendment A41); zero when the line has none or it is not mapped.
	SourceCategory uuid.UUID
}

type subject struct {
	Subject
	description, rawDescription string
}

func newSubject(s Subject) subject {
	return subject{Subject: s, description: Normalize(s.Description), rawDescription: Normalize(s.RawDescription)}
}

func (r Rule) matches(s subject) bool {
	for _, c := range r.Conditions {
		if !c.holds(s) {
			return false
		}
	}
	return true
}

func (c Condition) holds(s subject) bool {
	switch c.Field {
	case FieldDescription:
		return c.holdsText(s.Description, s.description)
	case FieldRawDescription:
		return c.holdsText(s.RawDescription, s.rawDescription)
	case FieldPayee:
		return s.PayeeID != uuid.Nil && slices.Contains(c.IDs, s.PayeeID)
	case FieldAccount:
		return slices.ContainsFunc(s.Accounts, func(id uuid.UUID) bool { return slices.Contains(c.IDs, id) })
	case FieldAccountKind:
		return slices.ContainsFunc(s.AccountKinds, func(k string) bool { return slices.Contains(c.Text, k) })
	case FieldSource:
		return slices.Contains(c.Text, s.Source)
	case FieldWeekday:
		return slices.Contains(c.Text, weekdays[s.Date.Weekday()])
	case FieldDayOfMonth:
		return c.holdsInt(int64(s.Date.Day()), func(i int) int64 { return int64(c.Ints[i]) }, len(c.Ints))
	case FieldInstallment:
		return s.Installment == c.Bool
	case FieldAmount, FieldAbsoluteAmount:
		if s.Amount.Currency() != c.Money[0].Currency() {
			return false
		}
		amount := s.Amount.Amount()
		if c.Field == FieldAbsoluteAmount && amount < 0 {
			amount = -amount
		}
		return c.holdsInt(amount, func(i int) int64 { return c.Money[i].Amount() }, len(c.Money))
	}
	return false
}

func (c Condition) holdsText(original, normalized string) bool {
	switch c.Operator {
	case OpEquals, OpInList:
		return slices.Contains(c.normalized, normalized)
	case OpContains:
		return strings.Contains(normalized, c.normalized[0])
	case OpStartsWith:
		return strings.HasPrefix(normalized, c.normalized[0])
	case OpRegex:
		return c.re.MatchString(original)
	}
	return false
}

func (c Condition) holdsInt(v int64, value func(int) int64, n int) bool {
	switch c.Operator {
	case OpEquals:
		return v == value(0)
	case OpGreaterThan:
		return v > value(0)
	case OpLessThan:
		return v < value(0)
	case OpBetween:
		return v >= value(0) && v <= value(1)
	case OpInList:
		for i := range n {
			if v == value(i) {
				return true
			}
		}
	}
	return false
}
