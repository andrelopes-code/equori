package app

import (
	"slices"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// conditions sets what the criteria of the group say about it and its members (CO1, CO3, CO6 to
// CO8).
func (a *assembler) conditions(out *ContributionClass, c domain.PlanClass, i int) {
	out.QuestionEffects = c.QuestionEffects
	out.QuestionReviews = c.QuestionReviews
	out.Held = a.holds.Classes[i]

	for j, m := range c.Members {
		out.Members[j].AnswerDates = m.AnswerDates
		out.Members[j].AnswerOverrides = m.AnswerOverrides
		out.Members[j].Released = m.ReleasedOn(a.today)
		out.Members[j].Held = a.holds.Members[i][j]
		out.Members[j].HeldBy = c.AnsweredNo(j, domain.EffectHold)
		out.Members[j].WarnedBy = c.AnsweredNo(j, domain.EffectWarn)
		out.Members[j].Due = c.Due(j, a.today)
	}
}

// split divides the amount of the plan over the classes, then over the members of a class with
// member ideals (CN7, CN8, CO9), and sets the figures after it.
func (a *assembler) split(view *ContributionView, p domain.Plan) {
	values := classValues(view)
	amount := p.Amount.Amount()
	amounts := domain.Split(a.classSlots(view, values), amount)
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
		a.splitMembers(&view.Classes[i], p.Classes[i], a.heldMembers(i), amounts[i])
	}

	a.forgone(view, p, values, amount)
}

func (a *assembler) splitMembers(
	c *ContributionClass,
	plan domain.PlanClass,
	held []bool,
	amount int64,
) {
	after := memberValues(c)

	if ideals := plan.MemberIdeals(); ideals != nil {
		for j, part := range domain.Split(memberSlots(c, ideals, held), amount) {
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

// forgone sets what each held group or member gives up: its part of the split without holds
// (CO14).
func (a *assembler) forgone(view *ContributionView, p domain.Plan, values []int64, amount int64) {
	if a.holds.Ignored {
		return
	}

	plain := domain.Split(classSlots(view, values), amount)

	for i := range view.Classes {
		c := &view.Classes[i]

		ideals := p.Classes[i].MemberIdeals()
		if ideals == nil && a.holds.Classes[i] {
			part := a.money(plain[i])
			c.Forgone = &part

			continue
		}

		if ideals == nil || !slices.Contains(a.holds.Members[i], true) {
			continue
		}

		parts := domain.Split(memberSlots(c, ideals, nil), plain[i])
		for j, held := range a.holds.Members[i] {
			if held {
				part := a.money(parts[j])
				c.Members[j].Forgone = &part
			}
		}
	}
}

// classSlots returns the slots of the split: a held class takes ideal 0 (CO9).
func (a *assembler) classSlots(view *ContributionView, values []int64) []domain.Slot {
	slots := classSlots(view, values)
	if a.holds.Ignored {
		return slots
	}

	for i, held := range a.holds.Classes {
		if held {
			slots[i].TargetBP = 0
		}
	}

	return slots
}

// heldMembers returns the held members of class i, none when the holds are ignored (CO13).
func (a *assembler) heldMembers(i int) []bool {
	if a.holds.Ignored {
		return nil
	}

	return a.holds.Members[i]
}

// memberSlots returns the slots of the members of a class: a held member takes ideal 0 (CO9).
func memberSlots(c *ContributionClass, ideals []int, held []bool) []domain.Slot {
	slots := make([]domain.Slot, len(ideals))

	for j, ideal := range ideals {
		if j < len(held) && held[j] {
			ideal = 0
		}

		slots[j] = domain.Slot{TargetBP: ideal, Value: c.Members[j].Value.Amount()}
	}

	return slots
}
