package toolapi

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

// maxDailyPoints bounds the balances view; a longer period keeps one point per week (spec 7.4).
const maxDailyPoints = 92

type historyView string

func (historyView) Values() []string { return []string{"balances", "flows"} }

type getAccountHistoryIn struct {
	AccountID string      `json:"account_id" jsonschema:"account from list_accounts"`
	View      historyView `json:"view" jsonschema:"balances gives the balance each day; flows gives inflow and outflow each day with postings"`
	From      tool.Date   `json:"from" jsonschema:"first date, inclusive"`
	To        tool.Date   `json:"to" jsonschema:"last date, inclusive; at most 366 days after from"`
}

type pointView struct {
	Date    tool.Date  `json:"date"`
	Balance tool.Money `json:"balance"`
}

type flowView struct {
	Date    tool.Date  `json:"date"`
	Inflow  tool.Money `json:"inflow"`
	Outflow tool.Money `json:"outflow"`
}

type getAccountHistoryOut struct {
	AccountID   string      `json:"account_id"`
	AccountName string      `json:"account_name"`
	Currency    string      `json:"currency" jsonschema:"currency or instrument code of the account"`
	View        string      `json:"view"`
	Granularity string      `json:"granularity,omitzero" jsonschema:"day lists every day; week, for periods over 92 days, lists each Sunday and the last day"`
	Points      []pointView `json:"points,omitzero"`
	Days        []flowView  `json:"days,omitzero" jsonschema:"only days with postings"`
}

func getAccountHistory(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_account_history",
		Description: "Returns the daily balance of an account and its sub-accounts over a period, or its booked inflow and outflow per day. " +
			"Use it for how a balance evolved or how much entered and left an account. " +
			"Do not use it for a balance at one date: get_balances does; nor for the future: project_balance does.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, userID int64, in getAccountHistoryIn) (getAccountHistoryOut, error) {
		id, err := uuid.Parse(in.AccountID)
		if err != nil {
			return getAccountHistoryOut{}, tool.InvalidArgument("account_id", "is not a UUID")
		}
		if in.To.Before(in.From.Time) || in.To.After(in.From.AddDate(0, 0, app.MaxFlowDays-1)) {
			return getAccountHistoryOut{}, tool.InvalidArgument("to", "must be on or after from and at most 365 days after it")
		}
		name, err := svc.AccountName(ctx, userID, id)
		if err != nil {
			return getAccountHistoryOut{}, err
		}
		out := getAccountHistoryOut{AccountID: in.AccountID, AccountName: name, View: string(in.View)}
		if in.View == "flows" {
			flows, instrument, err := svc.Flows(ctx, userID, id, in.From.Time, in.To.Time)
			if err != nil {
				return getAccountHistoryOut{}, err
			}
			out.Currency, out.Days = instrument, []flowView{}
			for _, f := range flows {
				inflow, err := money.New(f.Inflow, money.Currency(instrument))
				if err != nil {
					return getAccountHistoryOut{}, err
				}
				outflow, err := money.New(f.Outflow, money.Currency(instrument))
				if err != nil {
					return getAccountHistoryOut{}, err
				}
				out.Days = append(out.Days, flowView{Date: tool.DateOf(f.Date), Inflow: tool.MoneyOf(inflow), Outflow: tool.MoneyOf(outflow)})
			}
			return out, nil
		}
		points, currency, err := svc.Series(ctx, userID, id, in.From.Time, in.To.Time, app.BasisBooked)
		if err != nil {
			return getAccountHistoryOut{}, err
		}
		weekly := len(points) > maxDailyPoints
		out.Currency, out.Granularity, out.Points = currency, "day", []pointView{}
		if weekly {
			out.Granularity = "week"
		}
		for i, p := range points {
			if weekly && p.Date.Weekday() != time.Sunday && i != len(points)-1 {
				continue
			}
			m, err := money.New(p.Balance, money.Currency(currency))
			if err != nil {
				return getAccountHistoryOut{}, err
			}
			out.Points = append(out.Points, pointView{Date: tool.DateOf(p.Date), Balance: tool.MoneyOf(m)})
		}
		return out, nil
	})
}
