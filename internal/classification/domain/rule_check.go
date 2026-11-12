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

	if err := checkValues(&c, value); err != nil {
		return Condition{}, err
	}

	return c, nil
}

// checkValues validates the values of c by field; value is the path of the errors.
func checkValues(c *Condition, value string) error {
	switch c.Field {
	case FieldDescription, FieldRawDescription:
		return checkTextValues(c, value)
	case FieldAccountKind, FieldSource, FieldWeekday:
		return checkEnumValues(*c, value)
	case FieldPayee, FieldAccount:
		if slices.Contains(c.IDs, uuid.Nil) {
			return invalid(value, "must be an id")
		}
	case FieldAmount, FieldAbsoluteAmount:
		return checkMoneyValues(*c, value)
	case FieldDayOfMonth:
		return checkDayValues(*c, value)
	}

	return nil
}

// checkTextValues normalizes the text values of c and compiles its pattern.
func checkTextValues(c *Condition, value string) error {
	c.normalized = make([]string, len(c.Text))
	for i, t := range c.Text {
		if n := utf8.RuneCountInString(t); n == 0 || n > maxTextValue {
			return invalid(value, fmt.Sprintf("must have 1 to %d characters", maxTextValue))
		}

		c.normalized[i] = Normalize(t)
	}

	if c.Operator == OpRegex {
		re, err := regexp.Compile(c.Text[0])
		if err != nil {
			return invalid(value, "is not a valid RE2 pattern")
		}

		c.re = re
	}

	return nil
}

// checkEnumValues requires each text value of c to belong to the set of its field.
func checkEnumValues(c Condition, value string) error {
	allowed := map[Field][]string{FieldAccountKind: accountKinds, FieldSource: sources, FieldWeekday: weekdays}[c.Field]
	for _, t := range c.Text {
		if !slices.Contains(allowed, t) {
			return invalid(value, "must be one of "+strings.Join(allowed, ", "))
		}
	}

	return nil
}

// checkMoneyValues requires one currency, and a minimum first in a range.
func checkMoneyValues(c Condition, value string) error {
	for _, m := range c.Money {
		if m.Currency() != c.Money[0].Currency() {
			return invalid(value, "must use one currency")
		}

		if c.Field == FieldAbsoluteAmount && m.IsNegative() {
			return invalid(value, "must not be negative")
		}
	}

	if c.Operator == OpBetween && c.Money[0].Amount() > c.Money[1].Amount() {
		return invalid(value, "must list the minimum first")
	}

	return nil
}

// checkDayValues requires days from 1 to 31, and a minimum first in a range.
func checkDayValues(c Condition, value string) error {
	for _, d := range c.Ints {
		if d < 1 || d > 31 {
			return invalid(value, "must be between 1 and 31")
		}
	}

	if c.Operator == OpBetween && c.Ints[0] > c.Ints[1] {
		return invalid(value, "must list the minimum first")
	}

	return nil
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

	var t partTotals
	for i, p := range parts {
		if err := checkPart(fmt.Sprintf("%s[%d]", field, i), p, &t); err != nil {
			return err
		}
	}

	if t.remainders != 1 {
		return invalid(field, "must have exactly one remainder part")
	}

	if t.percent >= basisPointsAll {
		return invalid(field, "percent parts must sum to less than 10000 basis points")
	}

	return nil
}

// partTotals accumulates what the parts of a split declare.
type partTotals struct {
	remainders, percent int
	currency            money.Currency
}

// checkPart validates one part of a split at path pf and adds it to t.
func checkPart(pf string, p Part, t *partTotals) error {
	if p.CategoryID == uuid.Nil {
		return invalid(pf+".category_id", "is required")
	}

	shares := 0
	if p.Percent != 0 {
		shares++

		if p.Percent < 1 || p.Percent >= basisPointsAll {
			return invalid(pf+".percent", "must be between 1 and 9999 basis points")
		}

		t.percent += p.Percent
	}

	if p.Amount != nil {
		shares++

		if p.Amount.IsNegative() || p.Amount.IsZero() {
			return invalid(pf+".amount", "must be positive")
		}

		if t.currency != "" && p.Amount.Currency() != t.currency {
			return invalid(pf+".amount", "must use one currency")
		}

		t.currency = p.Amount.Currency()
	}

	if p.Remainder {
		shares++
		t.remainders++
	}

	if shares != 1 {
		return invalid(pf, "must have exactly one of percent, amount and remainder")
	}

	return nil
}
