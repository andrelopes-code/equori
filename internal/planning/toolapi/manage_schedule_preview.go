package toolapi

import (
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

var unitWords = map[domain.Frequency][2]string{
	domain.Daily: {"daily", "days"}, domain.Weekly: {"weekly", "weeks"}, domain.Monthly: {"monthly", "months"}, domain.Yearly: {"yearly", "years"},
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
		changes = append(changes, tool.Change{Field: "date",
			Before: tool.DateValue(s.Terms[0].EffectiveFrom), After: tool.DateValue(in.StartsOn.Time)})
	}

	if in.MatchToleranceBP.Set || in.GraceDays.Set || in.MatchWindowDays.Set {
		after := s
		after.ToleranceBP = pick(in.MatchToleranceBP, s.ToleranceBP)
		after.GraceDays = pick(in.GraceDays, s.GraceDays)
		after.WindowDays = pick(in.MatchWindowDays, s.WindowDays)
		changes = append(changes, tool.Change{Field: "terms",
			Before: tool.TextValue(describeMatching(s)), After: tool.TextValue(describeMatching(after))})
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
	return fmt.Sprintf("amount tolerance %d bp, %d grace days, %d day window", s.ToleranceBP, s.GraceDays, s.WindowDays)
}
