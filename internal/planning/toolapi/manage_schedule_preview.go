package toolapi

import (
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

var unitWords = map[domain.Frequency][2]string{
	domain.Daily: {
		"daily",
		"days",
	},
	domain.Weekly:  {"weekly", "weeks"},
	domain.Monthly: {"monthly", "months"},
	domain.Yearly:  {"yearly", "years"},
}

func previewSchedule(in manageScheduleIn, p schedulePlan) (tool.Preview, error) {
	pv := tool.Preview{Action: "manage_schedule." + string(in.Action)}
	switch in.Action {
	case "create":
		previewScheduleCreate(&pv, in, p)

		return pv, nil
	case "update":
		pv.Target, pv.Changes = p.schedule.Description, updateChanges(p.schedule, in)
	case "change_terms", "revise_terms":
		if err := previewTermsChange(&pv, in, p); err != nil {
			return tool.Preview{}, err
		}
	case "remove_terms":
		previewTermsRemoval(&pv, p)
	case "pause", "end":
		previewScheduleStop(&pv, in, p)
	}

	return pv, nil
}

func previewScheduleCreate(pv *tool.Preview, in manageScheduleIn, p schedulePlan) {
	pv.Target = in.Description
	pv.Recurrence = recurrenceOf(*p.rule)

	counterpart := "category"
	if in.Kind == "transfer" || in.Kind == "savings" {
		counterpart = "account"
	}

	pv.Changes = []tool.Change{
		{Field: "schedule", After: tool.TextValue(in.Description)},
		{Field: "amount", After: tool.MoneyValue(*p.amount)},
		{Field: "terms", After: tool.TextValue(describeTerms(*p.rule, in.Start.Time))},
		{Field: "account", After: tool.TextValue(p.account.Name)},
		{Field: counterpart, After: tool.TextValue(p.counterpart.Name)},
		{Field: "date", After: tool.DateValue(in.Start.Time)},
	}
	if p.paidBy != uuid.Nil {
		pv.Changes = append(pv.Changes, tool.Change{
			Field: "transaction",
			After: tool.TextValue(
				p.paidByFact.Description + " " + p.paidByFact.Date.Format(time.DateOnly),
			),
		})
	}
}

func previewTermsChange(pv *tool.Preview, in manageScheduleIn, p schedulePlan) error {
	last := p.schedule.Terms[len(p.schedule.Terms)-1]

	pv.Target, pv.Basis = p.schedule.Description, last.EffectiveFrom.Format(
		time.DateOnly,
	)+"|"+fmt.Sprint(
		last.Amount,
	)
	if p.amount != nil {
		before, err := money.New(last.Amount, p.schedule.Currency)
		if err != nil {
			return err
		}

		pv.Changes = append(
			pv.Changes,
			tool.Change{
				Field:  "amount",
				Before: tool.MoneyValue(before),
				After:  tool.MoneyValue(*p.amount),
			},
		)
	}

	if p.rule != nil {
		pv.Recurrence = recurrenceOf(*p.rule)
		pv.Changes = append(pv.Changes, tool.Change{
			Field: "terms",
			Before: tool.TextValue(
				describeTerms(last.Rule, last.EffectiveFrom),
			),
			After: tool.TextValue(describeTerms(*p.rule, in.From.Time)),
		})
	}

	pv.Changes = append(pv.Changes, tool.Change{Field: "date", After: tool.DateValue(in.From.Time)})

	return nil
}

// previewTermsRemoval names the latest terms version removed and the version that applies again.
func previewTermsRemoval(pv *tool.Preview, p schedulePlan) {
	n := len(p.schedule.Terms)
	last := p.schedule.Terms[n-1]
	pv.Target, pv.Basis = p.schedule.Description, last.EffectiveFrom.Format(
		time.DateOnly,
	)+"|"+fmt.Sprint(
		last.Amount,
	)

	after := "removed"
	if n > 1 {
		after = "removed; the terms from " +
			p.schedule.Terms[n-2].EffectiveFrom.Format(time.DateOnly) + " apply again"
	}

	pv.Changes = []tool.Change{
		{
			Field:  "terms",
			Before: tool.TextValue(describeTerms(last.Rule, last.EffectiveFrom)),
			After:  tool.TextValue(after),
		},
		{Field: "date", After: tool.DateValue(last.EffectiveFrom)},
	}
}

func previewScheduleStop(pv *tool.Preview, in manageScheduleIn, p schedulePlan) {
	last := p.schedule.Terms[len(p.schedule.Terms)-1]
	pv.Target, pv.Basis = p.schedule.Description, last.EffectiveFrom.Format(
		time.DateOnly,
	)+"|"+fmt.Sprint(
		last.Amount,
	)

	after := "ends on " + in.From.Format(time.DateOnly)
	if in.Action == "pause" {
		after = "paused from " + in.From.Format(
			time.DateOnly,
		) + " to " + in.To.Format(
			time.DateOnly,
		)
	}

	pv.Changes = []tool.Change{
		{
			Field:  "schedule",
			Before: tool.TextValue(p.schedule.Description),
			After:  tool.TextValue(after),
		},
		{Field: "date", After: tool.DateValue(in.From.Time)},
	}
}

func recurrenceOf(r domain.Rule) *tool.Recurrence {
	return &tool.Recurrence{Frequency: string(r.Frequency), Interval: r.Interval, Day: r.DayOfMonth}
}

func describeTerms(r domain.Rule, from time.Time) string {
	words := unitWords[r.Frequency]

	s := words[0]
	if r.Interval > 1 {
		s = fmt.Sprintf("every %d %s", r.Interval, words[1])
	}

	if r.DayOfMonth != 0 {
		s += fmt.Sprintf(" on day %d", r.DayOfMonth)
	}

	return s + " from " + from.Format(time.DateOnly)
}

func hasUpdateField(in manageScheduleIn) bool {
	return in.Description != "" || !in.StartsOn.IsZero() ||
		in.MatchToleranceBP.Set || in.GraceDays.Set || in.MatchWindowDays.Set
}

func scheduleChange(in manageScheduleIn) app.ScheduleChange {
	c := app.ScheduleChange{
		ToleranceBP: optionalInt(in.MatchToleranceBP), GraceDays: optionalInt(in.GraceDays),
		WindowDays: optionalInt(in.MatchWindowDays),
	}
	if in.Description != "" {
		c.Description = &in.Description
	}

	if !in.StartsOn.IsZero() {
		c.StartsOn = &in.StartsOn.Time
	}

	return c
}

func optionalInt(o tool.OptionalInt) *int {
	if !o.Set {
		return nil
	}

	return &o.N
}

// updateChanges lists each field the update sets, with the value it replaces. The matching
// settings share one change: Change.Field is a closed vocabulary that the chat screen labels.
func updateChanges(s domain.Schedule, in manageScheduleIn) []tool.Change {
	var changes []tool.Change
	if in.Description != "" {
		changes = append(changes, tool.Change{Field: "description",
			Before: tool.TextValue(s.Description), After: tool.TextValue(in.Description)})
	}

	if !in.StartsOn.IsZero() {
		changes = append(changes, tool.Change{
			Field: "date",
			Before: tool.DateValue(
				s.Terms[0].EffectiveFrom,
			),
			After: tool.DateValue(in.StartsOn.Time),
		})
	}

	if in.MatchToleranceBP.Set || in.GraceDays.Set || in.MatchWindowDays.Set {
		after := s
		after.ToleranceBP = pick(in.MatchToleranceBP, s.ToleranceBP)
		after.GraceDays = pick(in.GraceDays, s.GraceDays)
		after.WindowDays = pick(in.MatchWindowDays, s.WindowDays)
		changes = append(changes, tool.Change{
			Field: "terms",
			Before: tool.TextValue(
				describeMatching(s),
			),
			After: tool.TextValue(describeMatching(after)),
		})
	}

	return changes
}

func pick(o tool.OptionalInt, current int) int {
	if o.Set {
		return o.N
	}

	return current
}

func describeMatching(s domain.Schedule) string {
	return fmt.Sprintf(
		"amount tolerance %d bp, %d grace days, %d day window",
		s.ToleranceBP,
		s.GraceDays,
		s.WindowDays,
	)
}
