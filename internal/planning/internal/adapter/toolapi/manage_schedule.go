package toolapi

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageScheduleAction string

func (manageScheduleAction) Values() []string {
	return []string{"create", "change_terms", "pause", "end"}
}

type manageScheduleKind string

func (manageScheduleKind) Values() []string {
	return []string{"bill", "income", "subscription", "transfer", "savings"}
}

type manageScheduleFrequency string

func (manageScheduleFrequency) Values() []string {
	return []string{"daily", "weekly", "monthly", "yearly"}
}

type manageScheduleIn struct {
	Action        manageScheduleAction    `json:"action" jsonschema:"operation to propose"`
	ScheduleID    string                  `json:"schedule_id,omitzero" jsonschema:"for change_terms, pause and end: schedule from list_schedules"`
	Kind          manageScheduleKind      `json:"kind,omitzero" jsonschema:"for create: kind of schedule"`
	Description   string                  `json:"description,omitzero" jsonschema:"for create: description of each transaction"`
	AccountID     string                  `json:"account_id,omitzero" jsonschema:"for create: balance account the money leaves or reaches"`
	CounterpartID string                  `json:"counterpart_id,omitzero" jsonschema:"for create: category, or the other account of a transfer"`
	PayeeID       string                  `json:"payee_id,omitzero" jsonschema:"for create: payee from list_payees_and_tags"`
	Amount        string                  `json:"amount,omitzero" jsonschema:"for create and change_terms: positive amount of each occurrence"`
	Frequency     manageScheduleFrequency `json:"frequency,omitzero" jsonschema:"for create and change_terms: repetition unit"`
	Interval      int                     `json:"interval,omitzero" jsonschema:"for create and change_terms: repeat every this many units; 1 when absent"`
	DayOfMonth    int                     `json:"day_of_month,omitzero" jsonschema:"for monthly schedules: day of the month"`
	Start         tool.Date               `json:"start,omitzero" jsonschema:"for create: date of the first occurrence"`
	Until         tool.Date               `json:"until,omitzero" jsonschema:"for create: last possible date; absent for no end"`
	From          tool.Date               `json:"from,omitzero" jsonschema:"for change_terms: first date the new terms apply; for pause: first paused date; for end: first date without occurrences"`
	To            tool.Date               `json:"to,omitzero" jsonschema:"for pause: last paused date"`
}

// schedulePlan holds what a manage_schedule call reads and validates before it previews or writes.
type schedulePlan struct {
	schedule             domain.Schedule // the schedule changed; zero for create
	account, counterpart Account
	accountID, counterID uuid.UUID
	payeeID              uuid.UUID
	amount               *money.Money
	rule                 *domain.Rule
}

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

func validationError(field, message string) error {
	return &domain.FieldError{Field: field, Message: message, Err: domain.ErrValidation}
}

func prepareSchedule(ctx context.Context, svc *app.Service, l Ledger, userID int64, in manageScheduleIn) (schedulePlan, error) {
	given := func(s string) bool { return s != "" }
	fields := []field{
		{"schedule_id", given(in.ScheduleID)}, {"kind", given(string(in.Kind))}, {"description", given(in.Description)},
		{"account_id", given(in.AccountID)}, {"counterpart_id", given(in.CounterpartID)}, {"payee_id", given(in.PayeeID)},
		{"amount", given(in.Amount)}, {"frequency", given(string(in.Frequency))}, {"interval", in.Interval != 0},
		{"day_of_month", in.DayOfMonth != 0}, {"start", !in.Start.IsZero()}, {"until", !in.Until.IsZero()},
		{"from", !in.From.IsZero()}, {"to", !in.To.IsZero()},
	}
	name := string(in.Action)
	var err error
	switch in.Action {
	case "create":
		err = required(name, fields, []string{"kind", "description", "account_id", "counterpart_id", "amount", "frequency", "start"},
			"payee_id", "interval", "day_of_month", "until")
	case "change_terms":
		err = required(name, fields, []string{"schedule_id", "from"}, "amount", "frequency", "interval", "day_of_month")
		switch {
		case err != nil:
		case in.Amount == "" && in.Frequency == "":
			err = tool.InvalidArgument("amount", "is required for change_terms unless frequency is given")
		case in.Frequency == "" && in.Interval != 0:
			err = tool.InvalidArgument("interval", "requires frequency")
		case in.Frequency == "" && in.DayOfMonth != 0:
			err = tool.InvalidArgument("day_of_month", "requires frequency")
		}
	case "pause":
		err = required(name, fields, []string{"schedule_id", "from", "to"})
	case "end":
		err = required(name, fields, []string{"schedule_id", "from"})
	}
	if err != nil {
		return schedulePlan{}, err
	}
	var p schedulePlan
	var scheduleID uuid.UUID
	for _, id := range []struct {
		s, field string
		into     *uuid.UUID
	}{
		{in.ScheduleID, "schedule_id", &scheduleID}, {in.AccountID, "account_id", &p.accountID},
		{in.CounterpartID, "counterpart_id", &p.counterID}, {in.PayeeID, "payee_id", &p.payeeID},
	} {
		if *id.into, err = optionalID(id.s, id.field); err != nil {
			return schedulePlan{}, err
		}
	}
	if scheduleID != uuid.Nil {
		if p.schedule, err = svc.Schedule(ctx, userID, scheduleID); err != nil {
			return schedulePlan{}, err
		}
	}
	unit := money.Money{}
	switch in.Action {
	case "create":
		accounts, err := l.Accounts(ctx, userID)
		if err != nil {
			return schedulePlan{}, err
		}
		var ok bool
		if p.account, ok = accounts[p.accountID]; !ok {
			return schedulePlan{}, validationError("account_id", "must be a balance account of the user")
		}
		if p.counterpart, ok = accounts[p.counterID]; !ok {
			return schedulePlan{}, validationError("counterpart_id", "does not fit kind "+string(in.Kind))
		}
		unit, err = unitOf(p.account.Instrument)
		if err != nil {
			return schedulePlan{}, err
		}
		rule := domain.Rule{
			Frequency: domain.Frequency(in.Frequency), Interval: max(in.Interval, 1), DayOfMonth: in.DayOfMonth,
			Adjustment: "none", Start: in.Start.Time,
		}
		if !in.Until.IsZero() {
			rule.Until = &in.Until.Time
		}
		p.rule = &rule
	case "change_terms":
		if unit, err = unitOf(p.schedule.Currency); err != nil {
			return schedulePlan{}, err
		}
		if in.Frequency != "" {
			last := p.schedule.Terms[len(p.schedule.Terms)-1].Rule
			p.rule = &domain.Rule{
				Frequency: domain.Frequency(in.Frequency), Interval: max(in.Interval, 1), DayOfMonth: in.DayOfMonth,
				Adjustment: last.Adjustment, Start: last.Start, Until: last.Until,
			}
		}
	case "pause":
		if in.To.Before(in.From.Time) {
			return schedulePlan{}, validationError("to", "must not be before from")
		}
		for _, q := range p.schedule.Pauses {
			if !in.From.After(q.To) && !in.To.Before(q.From) {
				return schedulePlan{}, app.ErrPauseOverlap
			}
		}
	}
	if (in.Action == "change_terms" || in.Action == "pause" || in.Action == "end") && p.schedule.EndsOn != nil && !in.From.Before(*p.schedule.EndsOn) {
		return schedulePlan{}, app.ErrScheduleEnded
	}
	if p.rule != nil {
		if err := p.rule.Validate(); err != nil {
			return schedulePlan{}, err
		}
	}
	if in.Amount != "" {
		m, err := tool.ParsePositive("amount", in.Amount, unit)
		if err != nil {
			return schedulePlan{}, err
		}
		p.amount = &m
	}
	return p, nil
}

func manageSchedule(svc *app.Service, l Ledger, clk clock.Clock) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_schedule",
		Description: "Proposes creating a recurring schedule or changing one: new terms from a date, a pause, or an end. " +
			"Use it when the user sets up or changes a recurring bill, income, subscription, transfer or saving. " +
			"Do not use it for one occurrence: manage_occurrence does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, userID int64, in manageScheduleIn) (tool.Preview, error) {
		p, err := prepareSchedule(ctx, svc, l, userID, in)
		if err != nil {
			return tool.Preview{}, err
		}
		pv := tool.Preview{Action: "manage_schedule." + string(in.Action)}
		switch in.Action {
		case "create":
			pv.Target = "Schedule " + in.Description
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
			return pv, nil
		case "change_terms":
			last := p.schedule.Terms[len(p.schedule.Terms)-1]
			pv.Target, pv.Basis = "Schedule "+p.schedule.Description, last.EffectiveFrom.Format(time.DateOnly)+"|"+fmt.Sprint(last.Amount)
			if p.amount != nil {
				before, err := money.New(last.Amount, p.schedule.Currency)
				if err != nil {
					return tool.Preview{}, err
				}
				pv.Changes = append(pv.Changes, tool.Change{Field: "amount", Before: tool.MoneyValue(before), After: tool.MoneyValue(*p.amount)})
			}
			if p.rule != nil {
				pv.Changes = append(pv.Changes, tool.Change{Field: "terms",
					Before: tool.TextValue(describeTerms(last.Rule, last.EffectiveFrom)), After: tool.TextValue(describeTerms(*p.rule, in.From.Time))})
			}
			pv.Changes = append(pv.Changes, tool.Change{Field: "date", After: tool.DateValue(in.From.Time)})
		case "pause", "end":
			last := p.schedule.Terms[len(p.schedule.Terms)-1]
			pv.Target, pv.Basis = "Schedule "+p.schedule.Description, last.EffectiveFrom.Format(time.DateOnly)+"|"+fmt.Sprint(last.Amount)
			after := "ends on " + in.From.Format(time.DateOnly)
			if in.Action == "pause" {
				after = "paused from " + in.From.Format(time.DateOnly) + " to " + in.To.Format(time.DateOnly)
			}
			pv.Changes = []tool.Change{
				{Field: "schedule", Before: tool.TextValue(p.schedule.Description), After: tool.TextValue(after)},
				{Field: "date", After: tool.DateValue(in.From.Time)},
			}
		}
		return pv, nil
	}, func(ctx context.Context, userID int64, in manageScheduleIn) (scheduleView, error) {
		p, err := prepareSchedule(ctx, svc, l, userID, in)
		if err != nil {
			return scheduleView{}, err
		}
		var s domain.Schedule
		switch in.Action {
		case "create":
			s, err = svc.CreateSchedule(ctx, userID, app.ScheduleInput{
				Kind: domain.Kind(in.Kind), AccountID: p.accountID, CounterpartID: p.counterID, PayeeID: p.payeeID,
				Description: in.Description, Amount: *p.amount, Rule: *p.rule,
			})
		case "change_terms":
			s, err = svc.ChangeTerms(ctx, userID, p.schedule.ID, in.From.Time, p.amount, p.rule)
		case "pause":
			s, err = svc.Pause(ctx, userID, p.schedule.ID, in.From.Time, in.To.Time)
		default:
			s, err = svc.End(ctx, userID, p.schedule.ID, in.From.Time)
		}
		if err != nil {
			return scheduleView{}, err
		}
		accounts, err := l.Accounts(ctx, userID)
		if err != nil {
			return scheduleView{}, err
		}
		return toScheduleView(s, accounts, clk.Today(), nil, true)
	})
}
