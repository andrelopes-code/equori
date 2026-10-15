package domain

import (
	"errors"
	"fmt"
	"slices"
	"time"
)

var ErrNoBillingRule = errors.New("card has no billing cycle rule for the date")

// ReferenceMonth identifies a statement by the month of its due date (P2 amendment A1).
type ReferenceMonth struct {
	Year  int
	Month time.Month
}

func ParseReferenceMonth(s string) (ReferenceMonth, error) {
	t, err := time.Parse("2006-01", s)
	if err != nil {
		return ReferenceMonth{}, invalid("reference_month", "must be YYYY-MM")
	}
	return ReferenceMonth{Year: t.Year(), Month: t.Month()}, nil
}

func MonthOf(d time.Time) ReferenceMonth { return ReferenceMonth{Year: d.Year(), Month: d.Month()} }

func (m ReferenceMonth) Add(n int) ReferenceMonth { return MonthOf(m.FirstDay().AddDate(0, n, 0)) }

func (m ReferenceMonth) FirstDay() time.Time {
	return time.Date(m.Year, m.Month, 1, 0, 0, 0, 0, time.UTC)
}

func (m ReferenceMonth) Compare(o ReferenceMonth) int { return m.FirstDay().Compare(o.FirstDay()) }

func (m ReferenceMonth) String() string { return fmt.Sprintf("%04d-%02d", m.Year, int(m.Month)) }

// dayIn clamps day to the length of the month (T02).
func (m ReferenceMonth) dayIn(day int) time.Time {
	last := m.Add(1).FirstDay().AddDate(0, 0, -1).Day()
	return time.Date(m.Year, m.Month, min(day, last), 0, 0, 0, 0, time.UTC)
}

const (
	AssignNext    = "next"
	AssignClosing = "closing"
)

var adjustments = []string{"none", "following", "preceding", "modified_following"}

type BillingCycleRule struct {
	EffectiveFrom ReferenceMonth
	ClosingDay    int
	DueDay        int
	Assignment    string // AssignNext or AssignClosing (T04)
	Adjustment    string // shift of the due date: none, following, preceding, modified_following
	Calendar      string
}

func NewBillingCycleRule(r BillingCycleRule) (BillingCycleRule, error) {
	switch {
	case r.ClosingDay < 1 || r.ClosingDay > 31:
		return BillingCycleRule{}, invalid("closing_day", "must be between 1 and 31")
	case r.DueDay < 1 || r.DueDay > 31:
		return BillingCycleRule{}, invalid("due_day", "must be between 1 and 31")
	}
	if r.Assignment == "" {
		r.Assignment = AssignNext
	}
	if r.Assignment != AssignNext && r.Assignment != AssignClosing {
		return BillingCycleRule{}, invalid("closing_day_assignment", "must be next or closing")
	}
	if r.Adjustment == "" {
		r.Adjustment = "following"
	}
	if !slices.Contains(adjustments, r.Adjustment) {
		return BillingCycleRule{}, invalid("due_date_adjustment", "must be none, following, preceding or modified_following")
	}
	if r.Calendar == "" {
		r.Calendar = "br_banking"
	}
	return r, nil
}

// Rules are the versions of a card's billing cycle rule, in any order.
type Rules []BillingCycleRule

// For returns the version in force for the reference month (T05, I08).
func (rs Rules) For(m ReferenceMonth) (BillingCycleRule, error) {
	var found *BillingCycleRule
	for i := range rs {
		if rs[i].EffectiveFrom.Compare(m) <= 0 && (found == nil || rs[i].EffectiveFrom.Compare(found.EffectiveFrom) > 0) {
			found = &rs[i]
		}
	}
	if found == nil {
		return BillingCycleRule{}, ErrNoBillingRule
	}
	return *found, nil
}

type StatementDates struct {
	Reference     ReferenceMonth
	Closing       time.Time
	DueUnadjusted time.Time
}

// DatesFor places the closing date in the reference month when it precedes the due day,
// otherwise in the previous month (A1). Neither date is shifted here (A2).
func DatesFor(m ReferenceMonth, r BillingCycleRule) StatementDates {
	closingMonth := m
	if r.ClosingDay >= r.DueDay {
		closingMonth = m.Add(-1)
	}
	return StatementDates{Reference: m, Closing: closingMonth.dayIn(r.ClosingDay), DueUnadjusted: m.dayIn(r.DueDay)}
}

// StatementFor returns the first statement that closes after the purchase date, or on it
// when the rule in force assigns closing-day purchases to the closing statement (T04).
func StatementFor(purchase time.Time, rules Rules) (ReferenceMonth, error) {
	start := MonthOf(purchase).Add(-1)
	for i := range 4 {
		m := start.Add(i)
		r, err := rules.For(m)
		if errors.Is(err, ErrNoBillingRule) {
			continue
		}
		closing := DatesFor(m, r).Closing
		if purchase.Before(closing) || (r.Assignment == AssignClosing && purchase.Equal(closing)) {
			return m, nil
		}
	}
	return ReferenceMonth{}, ErrNoBillingRule
}

// InstallmentStatement is the statement of installment k when installment 1 is on first (T07).
func InstallmentStatement(first ReferenceMonth, k int) ReferenceMonth { return first.Add(k - 1) }
