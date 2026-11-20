package toolapi

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

type attributionYearView struct {
	Year     int                   `json:"year"`
	From     string                `json:"from"`
	To       string                `json:"to"`
	Missing  []string              `json:"missing,omitzero"   jsonschema:"instruments without a price at a year end; the year has no figures"`
	Result   tool.Money            `json:"result,omitzero"    jsonschema:"closing - opening - contributions of the portfolio in the year"`
	PeriodBP int                   `json:"period_bp,omitzero" jsonschema:"time-weighted return of the year in basis points; absent when undefined or zero"`
	Other    tool.Money            `json:"other,omitzero"     jsonschema:"result less the items: cash, fees and exchange"`
	Items    []attributionItemView `json:"items,omitzero"     jsonschema:"largest result first"`
}

type attributionItemView struct {
	Instrument string     `json:"instrument"`
	Result     tool.Money `json:"result"               jsonschema:"change of market value less cost, plus sales net of fees, taxes and cost, plus net income"`
	ReturnBP   int        `json:"return_bp,omitzero"   jsonschema:"modified Dietz return of the year in basis points; absent when zero, stale or nothing was invested"`
	StaleSince string     `json:"stale_since,omitzero" jsonschema:"date of the price used at a year end when older than 14 days"`
}

func attributionView(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
) (getPortfolioOut, error) {
	years, err := svc.Attribution(ctx, booksID)
	if err != nil {
		return getPortfolioOut{}, err
	}

	out := make([]attributionYearView, len(years))
	for i, y := range years {
		out[i] = attributionYearOf(y)
	}

	return getPortfolioOut{Years: out}, nil
}

func attributionYearOf(y app.AttributionYear) attributionYearView {
	v := attributionYearView{
		Year: y.Year,
		From: y.From.Format(time.DateOnly),
		To:   y.To.Format(time.DateOnly),
	}

	for _, code := range y.Missing {
		v.Missing = append(v.Missing, string(code))
	}

	if y.Result == nil {
		return v
	}

	v.Result, v.Other, v.PeriodBP = tool.MoneyOf(
		*y.Result,
	), tool.MoneyOf(
		*y.Other,
	), valueOf(
		y.PeriodBP,
	)

	for _, it := range y.Items {
		item := attributionItemView{
			Instrument: string(it.Instrument),
			Result:     tool.MoneyOf(it.Result),
			ReturnBP:   valueOf(it.ReturnBP),
		}
		if it.StaleSince != nil {
			item.StaleSince = it.StaleSince.Format(time.DateOnly)
		}

		v.Items = append(v.Items, item)
	}

	return v
}
