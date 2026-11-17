package app

import (
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// basisPoints is the denominator of the shares of a plan: 10000 basis points are the whole.
const basisPoints = 10000

// Plan is the budget plan of a month (budget plan amendments A129 and A131). Expected is nil
// when the book has no income schedule and Average when no month of history exists.
type Plan struct {
	Month                                    time.Time
	Currency                                 money.Currency
	Reference                                domain.Reference
	Expected                                 *int64
	ExpectedItems                            []PlanIncome
	Average                                  *int64
	AverageMonths                            int
	Received, Installments, Savings, Planned int64
	Rows                                     []domain.PlanRow
	Prices                                   []Price

	// Buckets is the book's bucket method; nil without one (A229, A230). BucketsFrom is the
	// start month of its version.
	Buckets                      []PlanBucket
	BucketsFrom                  time.Time
	OutsidePlanned, OutsideSpent int64
}

// PlanIncome is the income a schedule expects in the month.
type PlanIncome struct {
	ScheduleID  uuid.UUID
	Description string
	Amount      int64
}

// ReferenceAmount is the figure of the chosen source; false when the source has none.
func (p Plan) ReferenceAmount() (int64, bool) {
	switch p.Reference.Source {
	case domain.SourceExpectedIncome:
		if p.Expected != nil {
			return *p.Expected, true
		}
	case domain.SourceAverageIncome:
		if p.Average != nil {
			return *p.Average, true
		}
	case domain.SourceFixed:
		return p.Reference.Fixed, p.Reference.HasFixed
	}

	return 0, false
}

// Unassigned is reference − installments − savings − planned; false without a reference.
func (p Plan) Unassigned() (int64, bool) {
	ref, ok := p.ReferenceAmount()
	return ref - p.Installments - p.Savings - p.Planned, ok
}

// SavingsRate is savings as basis points of the reference, truncated; false unless the
// reference is above zero (A188).
func (p Plan) SavingsRate() (int, bool) {
	ref, ok := p.ReferenceAmount()
	if !ok || ref <= 0 {
		return 0, false
	}

	return int(p.Savings/ref*basisPoints + p.Savings%ref*basisPoints/ref), true
}

// SavingsTarget is the reference times the stored target, rounded half up; false without a
// target or a reference above zero (A188).
func (p Plan) SavingsTarget() (int64, bool) {
	ref, ok := p.ReferenceAmount()
	if !ok || ref <= 0 || !p.Reference.HasTarget {
		return 0, false
	}

	// ref = q×10000 + r keeps the product within int64.
	bp := int64(p.Reference.TargetBP)

	return ref/basisPoints*bp + (ref%basisPoints*bp+basisPoints/2)/basisPoints, true
}

// SavingsGap is what the target still lacks of the month's savings, never below zero (A188).
func (p Plan) SavingsGap() (int64, bool) {
	target, ok := p.SavingsTarget()
	if !ok {
		return 0, false
	}

	return max(target-p.Savings, 0), true
}
