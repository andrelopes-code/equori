package app

import (
	"fmt"
	"strconv"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// assembler builds the view in the base currency and keeps the first money error.
type assembler struct {
	base money.Currency
	err  error
}

func assemble(
	p domain.Plan,
	val valuation,
	base money.Currency,
	split bool,
) (ContributionView, error) {
	a := &assembler{base: base}
	view := ContributionView{
		Amount:   p.Amount,
		Complete: len(val.missing) == 0,
		Total:    a.money(0),
		Classes:  make([]ContributionClass, len(p.Classes)),
		Outside:  val.outside,
		Missing:  val.missing,
	}

	for i, c := range p.Classes {
		view.Classes[i] = a.class(c, val.values[i], val.units[i])
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

// class sums the members that have a value; a member without a price or rate counts zero and is
// listed in Missing (CN10).
func (a *assembler) class(
	c domain.PlanClass,
	values []money.Money,
	units []*money.Money,
) ContributionClass {
	out := ContributionClass{
		Name:           c.Name,
		TargetBP:       c.TargetBP,
		Questions:      c.Questions,
		QuestionIdeals: c.QuestionIdeals(),
		Members:        make([]ContributionMember, len(c.Members)),
	}

	var sum int64

	for j, m := range c.Members {
		value := values[j]
		sum += value.Amount()
		out.Members[j] = ContributionMember{
			AccountID:  m.AccountID,
			Instrument: m.Instrument,
			TargetBP:   m.TargetBP,
			Answers:    m.Answers,
			Value:      value,
			UnitValue:  units[j],
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
	}

	if bp, ok := domain.Drift(classSlots(view, values)); ok {
		view.DriftBP = &bp
	}
}

// split divides the amount of the plan over the classes, then over the members of a class with
// member targets (CN7, CN8), and sets the figures after it.
func (a *assembler) split(view *ContributionView, p domain.Plan) {
	values := classValues(view)
	amount := p.Amount.Amount()
	amounts := domain.Split(classSlots(view, values), amount)
	after := make([]int64, len(values))

	var totalAfter int64

	for i, v := range values {
		after[i] = v + amounts[i]
		totalAfter += after[i]
		part := a.money(amounts[i])
		view.Classes[i].Amount = &part
	}

	total := a.money(totalAfter)
	view.TotalAfter = &total

	if bp, ok := domain.Drift(classSlots(view, after)); ok {
		view.DriftAfterBP = &bp
	}

	if totalAfter > 0 {
		for i, bp := range sharesOf(after) {
			view.Classes[i].AfterShareBP = &bp
		}
	}

	for i := range view.Classes {
		a.splitMembers(&view.Classes[i], p.Classes[i].Members, amounts[i])
	}
}

func (a *assembler) splitMembers(c *ContributionClass, members []domain.PlanMember, amount int64) {
	after := memberValues(c)

	if len(members) > 0 && members[0].TargetBP != nil {
		slots := make([]domain.Slot, len(members))
		for j, m := range c.Members {
			slots[j] = domain.Slot{TargetBP: *members[j].TargetBP, Value: m.Value.Amount()}
		}

		for j, part := range domain.Split(slots, amount) {
			share := a.money(part)
			c.Members[j].Amount = &share
			after[j] += part
		}
	}

	var total int64
	for _, v := range after {
		total += v
	}

	if total <= 0 {
		return
	}

	for j, bp := range sharesOf(after) {
		c.Members[j].AfterShareBP = &bp
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
