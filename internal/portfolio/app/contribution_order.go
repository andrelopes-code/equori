package app

import (
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// receiver locates the target of one entry: member member of class class, or the whole class when
// member is negative.
type receiver struct {
	class  int
	member int
	one    bool // a group of one: the class takes the cost of its member too (CO10)
}

// orders turns the split of a complete preview into the orders and the leftover (CN17, CN18).
func (a *assembler) orders(view *ContributionView, p domain.Plan, val valuation) {
	entries, receivers := a.orderEntries(view, p, val)
	orders, leftover := domain.Execute(entries, p.Amount.Amount())

	for k, o := range orders {
		a.apply(view, receivers[k], entries[k], o, val)
	}

	left := a.money(leftover)
	view.Leftover = &left
}

// apply writes one order: the quantity and the cost on a member with a unit value, the cost alone
// on a cash-like member or on a class.
func (a *assembler) apply(
	view *ContributionView,
	r receiver,
	e domain.Entry,
	o domain.Order,
	val valuation,
) {
	cost := a.money(o.Cost)

	if r.member < 0 {
		view.Classes[r.class].Cost = &cost

		return
	}

	m := &view.Classes[r.class].Members[r.member]
	m.Cost = &cost

	if r.one {
		view.Classes[r.class].Cost = &cost
	}

	if e.Unit > 0 {
		q, err := money.NewOf(o.Quantity, m.Instrument, val.scales[r.class][r.member])
		if err != nil && a.err == nil {
			a.err = err
		}

		m.Quantity = &q
	}
}

// orderEntries lists one entry per member of a class with member ideals and one per other class.
// A held entry weighs 0 (CO12); a group of one is ordered on its member (CO10).
func (a *assembler) orderEntries(
	view *ContributionView,
	p domain.Plan,
	val valuation,
) ([]domain.Entry, []receiver) {
	var (
		entries   []domain.Entry
		receivers []receiver
	)

	for i, c := range view.Classes {
		ideals := p.Classes[i].MemberIdeals()

		if ideals == nil {
			weight := int64(c.TargetBP) * 10000
			if !a.holds.Ignored && a.holds.Classes[i] {
				weight = 0
			}

			entries = append(entries, domain.Entry{
				Weight:  weight,
				Value:   c.Value.Amount(),
				Planned: c.Amount.Amount(),
			})
			receivers = append(receivers, receiver{class: i, member: -1})

			continue
		}

		one := p.Classes[i].Members[0].TargetBP == nil
		held := a.heldMembers(i)

		for j, m := range c.Members {
			e := domain.Entry{
				Weight:  int64(c.TargetBP) * int64(ideals[j]),
				Value:   m.Value.Amount(),
				Planned: m.Amount.Amount(),
				Scale:   val.scales[i][j],
			}
			if j < len(held) && held[j] {
				e.Weight = 0
			}

			if m.UnitValue != nil {
				e.Unit = m.UnitValue.Amount()
			}

			entries = append(entries, e)
			receivers = append(receivers, receiver{class: i, member: j, one: one})
		}
	}

	return entries, receivers
}
