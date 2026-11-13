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
}

// orders turns the split of a complete preview into the orders and the leftover (CN17, CN18).
func (a *assembler) orders(view *ContributionView, p domain.Plan, val valuation) {
	entries, receivers := orderEntries(view, p, val)
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

	if e.Unit > 0 {
		q, err := money.NewOf(o.Quantity, m.Instrument, val.scales[r.class][r.member])
		if err != nil && a.err == nil {
			a.err = err
		}

		m.Quantity = &q
	}
}

// orderEntries lists one entry per member of a class with member targets and one per other class.
func orderEntries(
	view *ContributionView,
	p domain.Plan,
	val valuation,
) ([]domain.Entry, []receiver) {
	var (
		entries   []domain.Entry
		receivers []receiver
	)

	for i, c := range view.Classes {
		members := p.Classes[i].Members

		if len(members) == 0 || members[0].TargetBP == nil {
			entries = append(entries, domain.Entry{
				Weight:  int64(c.TargetBP) * 10000,
				Value:   c.Value.Amount(),
				Planned: c.Amount.Amount(),
			})
			receivers = append(receivers, receiver{class: i, member: -1})

			continue
		}

		for j, m := range c.Members {
			e := domain.Entry{
				Weight:  int64(c.TargetBP) * int64(*members[j].TargetBP),
				Value:   m.Value.Amount(),
				Planned: m.Amount.Amount(),
				Scale:   val.scales[i][j],
			}
			if m.UnitValue != nil {
				e.Unit = m.UnitValue.Amount()
			}

			entries = append(entries, e)
			receivers = append(receivers, receiver{class: i, member: j})
		}
	}

	return entries, receivers
}
