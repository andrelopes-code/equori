package domain

import (
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

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
	return subject{
		Subject:        s,
		description:    Normalize(s.Description),
		rawDescription: Normalize(s.RawDescription),
	}
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
		return slices.ContainsFunc(
			s.Accounts,
			func(id uuid.UUID) bool { return slices.Contains(c.IDs, id) },
		)
	case FieldAccountKind:
		return slices.ContainsFunc(
			s.AccountKinds,
			func(k string) bool { return slices.Contains(c.Text, k) },
		)
	case FieldSource:
		return slices.Contains(c.Text, s.Source)
	case FieldWeekday:
		return slices.Contains(c.Text, weekdays[s.Date.Weekday()])
	case FieldDayOfMonth:
		return c.holdsInt(
			int64(s.Date.Day()),
			func(i int) int64 { return int64(c.Ints[i]) },
			len(c.Ints),
		)
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
