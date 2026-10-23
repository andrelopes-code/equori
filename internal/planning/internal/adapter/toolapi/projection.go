package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type projectBalanceIn struct {
	AccountID string    `json:"account_id" jsonschema:"balance account from list_accounts"`
	To        tool.Date `json:"to" jsonschema:"last date projected, after today and at most 12 months ahead"`
}

type projectionPoint struct {
	Date        tool.Date  `json:"date"`
	Description string     `json:"description"`
	Amount      tool.Money `json:"amount"`
	Balance     tool.Money `json:"balance"`
}

type projectBalanceOut struct {
	AccountName string            `json:"account_name"`
	From        tool.Date         `json:"from"`
	To          tool.Date         `json:"to"`
	Opening     tool.Money        `json:"opening"`
	Closing     tool.Money        `json:"closing"`
	Points      []projectionPoint `json:"points"`
}

func projectBalance(svc *app.Service, l Ledger) tool.Tool {
	return tool.New(tool.Spec{
		Name: "project_balance",
		Description: "Projects the balance of an account to a future date from its schedules, with each expected occurrence on the way. " +
			"Use it for will there be enough money on a date. " +
			"Do not use it for past balances: get_account_history does.",
		Effect: tool.ReadOnly, Idempotent: true,
	}, func(ctx context.Context, userID int64, in projectBalanceIn) (projectBalanceOut, error) {
		id, err := optionalID(in.AccountID, "account_id")
		if err != nil {
			return projectBalanceOut{}, err
		}
		p, err := svc.Project(ctx, userID, id, in.To.Time)
		if err != nil {
			return projectBalanceOut{}, err
		}
		accounts, err := l.Accounts(ctx, userID)
		if err != nil {
			return projectBalanceOut{}, err
		}
		schedules, err := allSchedules(ctx, svc, userID)
		if err != nil {
			return projectBalanceOut{}, err
		}
		descriptions := make(map[uuid.UUID]string, len(schedules))
		for _, s := range schedules {
			descriptions[s.ID] = s.Description
		}
		out := projectBalanceOut{AccountName: accountName(accounts, id), From: tool.DateOf(p.From), To: tool.DateOf(p.To), Points: []projectionPoint{}}
		if out.Opening, err = moneyOf(p.Opening, p.Currency); err != nil {
			return out, err
		}
		if out.Closing, err = moneyOf(p.Closing, p.Currency); err != nil {
			return out, err
		}
		for _, pt := range p.Points {
			v := projectionPoint{Date: tool.DateOf(pt.Date), Description: descriptions[pt.ScheduleID]}
			if v.Amount, err = moneyOf(pt.Amount, p.Currency); err != nil {
				return out, err
			}
			if v.Balance, err = moneyOf(pt.Balance, p.Currency); err != nil {
				return out, err
			}
			out.Points = append(out.Points, v)
		}
		return out, nil
	})
}
