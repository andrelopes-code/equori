package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func manageSchedule(svc *app.Service, l Ledger, clk clock.Clock) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_schedule",
		Description: "Proposes creating a recurring schedule or changing one: update its description, first date or matching, " +
			"new, revised or removed terms, a pause, or an end. " +
			"Use it when the user sets up or changes a recurring bill, income, subscription, transfer or saving. " +
			"Do not use it for one occurrence: manage_occurrence does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in manageScheduleIn) (tool.Preview, error) {
		p, err := prepareSchedule(ctx, svc, l, booksID, in)
		if err != nil {
			return tool.Preview{}, err
		}

		return previewSchedule(in, p)
	}, func(ctx context.Context, booksID int64, in manageScheduleIn) (scheduleView, error) {
		p, err := prepareSchedule(ctx, svc, l, booksID, in)
		if err != nil {
			return scheduleView{}, err
		}

		s, err := runSchedule(ctx, svc, booksID, in, p)
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

func runSchedule(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageScheduleIn,
	p schedulePlan,
) (domain.Schedule, error) {
	switch in.Action {
	case "create":
		return svc.CreateSchedule(ctx, booksID, app.ScheduleInput{
			Kind: domain.Kind(
				in.Kind,
			),
			AccountID:     p.accountID,
			CounterpartID: p.counterID,
			PayeeID:       p.payeeID,
			Description:   in.Description,
			Amount:        *p.amount,
			Rule:          *p.rule,
			PaidBy:        p.paidBy,
			ToleranceBP:   optionalInt(in.MatchToleranceBP),
			GraceDays:     optionalInt(in.GraceDays),
			WindowDays:    optionalInt(in.MatchWindowDays),
		})
	case "update":
		return svc.Update(ctx, booksID, p.schedule.ID, scheduleChange(in))
	case "change_terms":
		return svc.ChangeTerms(ctx, booksID, p.schedule.ID, in.From.Time, p.amount, p.rule)
	case "revise_terms":
		latest := p.schedule.Terms[len(p.schedule.Terms)-1].EffectiveFrom

		return svc.ReviseTerms(ctx, booksID, p.schedule.ID, latest, in.From.Time, p.amount, p.rule)
	case "remove_terms":
		latest := p.schedule.Terms[len(p.schedule.Terms)-1].EffectiveFrom

		return svc.RemoveTerms(ctx, booksID, p.schedule.ID, latest)
	case "pause":
		return svc.Pause(ctx, booksID, p.schedule.ID, in.From.Time, in.To.Time)
	}

	return svc.End(ctx, booksID, p.schedule.ID, in.From.Time)
}
