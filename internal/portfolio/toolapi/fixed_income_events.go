package toolapi

import (
	"context"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

type fixedIncomeEventView struct {
	AccountName string     `json:"account_name"`
	Instrument  string     `json:"instrument"`
	Date        string     `json:"date"`
	Kind        string     `json:"kind"`
	Quantity    tool.Money `json:"quantity"`
	Gross       tool.Money `json:"gross,omitzero"`
	RateMissing bool       `json:"rate_missing,omitzero"`
	State       string     `json:"state"`
}

func fixedIncomeEventsView(
	ctx context.Context,
	svc *app.Service,
	names AccountNames,
	booksID int64,
	in getPortfolioIn,
) (getPortfolioOut, error) {
	es, err := svc.FixedIncomeEvents(ctx, booksID, in.From.Time, in.To.Time)
	if errors.Is(err, app.ErrInvalidEventRange) {
		return getPortfolioOut{}, tool.InvalidArgument(
			"to",
			"must be on or after from and at most 400 days after it",
		)
	}

	if err != nil {
		return getPortfolioOut{}, err
	}

	named, err := names(ctx, booksID)
	if err != nil {
		return getPortfolioOut{}, err
	}

	out := getPortfolioOut{FixedIncomeEvents: []fixedIncomeEventView{}}
	for _, e := range es {
		v := fixedIncomeEventView{
			AccountName: named[e.AccountID],
			Instrument:  string(e.Instrument),
			Date:        e.Date.Format(time.DateOnly),
			Kind:        e.Kind,
			Quantity:    tool.MoneyOf(e.Quantity),
			RateMissing: e.RateMissing,
			State:       e.State,
		}
		if e.Gross != nil {
			v.Gross = tool.MoneyOf(*e.Gross)
		}

		out.FixedIncomeEvents = append(out.FixedIncomeEvents, v)
	}

	return out, nil
}
