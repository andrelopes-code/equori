package toolapi

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func manageSchedule(svc *app.Service, l Ledger, clk clock.Clock) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_schedule",
		Description: "Proposes creating a recurring schedule or changing one: update its description, first date or matching, " +
			"new terms from a date, a pause, or an end. " +
			"Use it when the user sets up or changes a recurring bill, income, subscription, transfer or saving. " +
			"Do not use it for one occurrence: manage_occurrence does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in manageScheduleIn) (tool.Preview, error) {
		p, err := prepareSchedule(ctx, svc, l, booksID, in)
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
			if p.paidBy != uuid.Nil {
				pv.Changes = append(pv.Changes, tool.Change{Field: "transaction",
					After: tool.TextValue(p.paidByFact.Description + " " + p.paidByFact.Date.Format(time.DateOnly))})
			}

			return pv, nil
		case "update":
			pv.Target, pv.Changes = "Schedule "+p.schedule.Description, updateChanges(p.schedule, in)
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
	}, func(ctx context.Context, booksID int64, in manageScheduleIn) (scheduleView, error) {
		p, err := prepareSchedule(ctx, svc, l, booksID, in)
		if err != nil {
			return scheduleView{}, err
		}

		var s domain.Schedule
		switch in.Action {
		case "create":
			s, err = svc.CreateSchedule(ctx, booksID, app.ScheduleInput{
				Kind: domain.Kind(in.Kind), AccountID: p.accountID, CounterpartID: p.counterID, PayeeID: p.payeeID,
				Description: in.Description, Amount: *p.amount, Rule: *p.rule,
				PaidBy: p.paidBy, ToleranceBP: optionalInt(in.MatchToleranceBP),
				GraceDays: optionalInt(in.GraceDays), WindowDays: optionalInt(in.MatchWindowDays),
			})
		case "update":
			s, err = svc.Update(ctx, booksID, p.schedule.ID, scheduleChange(in))
		case "change_terms":
			s, err = svc.ChangeTerms(ctx, booksID, p.schedule.ID, in.From.Time, p.amount, p.rule)
		case "pause":
			s, err = svc.Pause(ctx, booksID, p.schedule.ID, in.From.Time, in.To.Time)
		default:
			s, err = svc.End(ctx, booksID, p.schedule.ID, in.From.Time)
		}

		if err != nil {
			return scheduleView{}, err
		}

		accounts, err := l.Accounts(ctx, booksID)
		if err != nil {
			return scheduleView{}, err
		}

		return toScheduleView(s, accounts, clk.Today(ctx), nil, true)
	})
}
