package app

import (
	"fmt"
	"strconv"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// assembler builds the view in the base currency and keeps the first money error.
type assembler struct {
	base  money.Currency
	holds domain.Holds
	today time.Time
	err   error
}

func assemble(
	p domain.Plan,
	val valuation,
	base money.Currency,
	split bool,
	today time.Time,
) (ContributionView, error) {
	a := &assembler{base: base, holds: p.Holds(today), today: today}
	view := ContributionView{
		Revision:     p.Revision,
		HoldsIgnored: a.holds.Ignored,
		Amount:       p.Amount,
		Complete:     len(val.missing) == 0,
		Total:        a.money(0),
		Classes:      make([]ContributionClass, len(p.Classes)),
		Outside:      val.outside,
		Missing:      val.missing,
	}

	for i, c := range p.Classes {
		view.Classes[i] = a.class(c, val.values[i], val.units[i], val.matched[i])
		a.conditions(&view.Classes[i], c, i)
	}

	view.Total = a.money(sumOf(classValues(&view)))

	if view.Complete {
		a.shares(&view)

		if split {
			a.split(&view, p)
			a.orders(&view, p, val)
		}
	}

	return view, a.err
}

func (a *assembler) money(n int64) money.Money {
	m, err := money.New(n, a.base)
	if err != nil && a.err == nil {
		a.err = err
	}

	return m
}

// class sums the members and the matched securities that have a value; one without a price or rate
// counts zero and is listed in Missing (CN10).
func (a *assembler) class(
	c domain.PlanClass,
	values []money.Money,
	units []*money.Money,
	matched []ContributionMatched,
) ContributionClass {
	out := ContributionClass{
		Name:           c.Name,
		TargetBP:       c.TargetBP,
		Questions:      c.Questions,
		QuestionFacts:  c.QuestionFacts,
		QuestionLimits: c.QuestionLimits,
		QuestionIdeals: c.QuestionIdeals(),
		Members:        make([]ContributionMember, len(c.Members)),
		Rules:          c.Rules,
		Matched:        matched,
	}

	var sum int64

	for _, m := range matched {
		sum += m.Value.Amount()
	}

	for j, m := range c.Members {
		value := values[j]
		sum += value.Amount()
		out.Members[j] = ContributionMember{
			AccountID:   m.AccountID,
			Instrument:  m.Instrument,
			TargetBP:    m.TargetBP,
			Answers:     m.Answers,
			FactAnswers: m.FactAnswers,
			FactDetails: m.FactDetails,
			FactsYear:   m.FactsYear,
			Value:       value,
			UnitValue:   units[j],
		}
	}

	out.Value = a.money(sum)

	return out
}

// shares sets the total, the shares and the drift before the contribution (CN5, CN15).
func (a *assembler) shares(view *ContributionView) {
	values := classValues(view)
	if sumOf(values) <= 0 {
		return
	}

	for i, bp := range sharesOf(values) {
		view.Classes[i].ShareBP = &bp
	}

	for i := range view.Classes {
		c := &view.Classes[i]
		if c.Value.Amount() <= 0 {
			continue
		}

		for j, bp := range sharesOf(memberValues(c)) {
			c.Members[j].ShareBP = &bp
		}

		for j, bp := range sharesOf(matchedValues(c)) {
			c.Matched[j].ShareBP = &bp
		}
	}

	if bp, ok := domain.Drift(classSlots(view, values)); ok {
		view.DriftBP = &bp
	}
}

func classValues(view *ContributionView) []int64 {
	out := make([]int64, len(view.Classes))
	for i, c := range view.Classes {
		out[i] = c.Value.Amount()
	}

	return out
}

func memberValues(c *ContributionClass) []int64 {
	out := make([]int64, len(c.Members))
	for j, m := range c.Members {
		out[j] = m.Value.Amount()
	}

	return out
}

func matchedValues(c *ContributionClass) []int64 {
	out := make([]int64, len(c.Matched))
	for j, m := range c.Matched {
		out[j] = m.Value.Amount()
	}

	return out
}

func classSlots(view *ContributionView, values []int64) []domain.Slot {
	slots := make([]domain.Slot, len(values))
	for i, v := range values {
		slots[i] = domain.Slot{TargetBP: view.Classes[i].TargetBP, Value: v}
	}

	return slots
}

// sharesOf returns the share in basis points of each value by position (CN15); the total is
// positive.
func sharesOf(values []int64) []int {
	holdings := make([]domain.Holding, len(values))
	for i, v := range values {
		holdings[i] = domain.Holding{Key: fmt.Sprintf("%02d", i), Value: v}
	}

	out := make([]int, len(values))

	for _, g := range domain.Allocate(holdings) {
		if i, err := strconv.Atoi(g.Key); err == nil {
			out[i] = g.ShareBP
		}
	}

	return out
}

func sumOf(values []int64) int64 {
	var total int64
	for _, v := range values {
		total += v
	}

	return total
}
