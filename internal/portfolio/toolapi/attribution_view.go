package toolapi

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

type attributionYearView struct {
	Year      int                   `json:"year"`
	From      string                `json:"from"`
	To        string                `json:"to"`
	Since     string                `json:"since,omitzero"     jsonschema:"first day with money at work"`
	Missing   []string              `json:"missing,omitzero"   jsonschema:"instruments without a price at a year end; the year has no figures"`
	Result    tool.Money            `json:"result,omitzero"`
	Capital   tool.Money            `json:"capital,omitzero"   jsonschema:"average money at work"`
	ReturnBP  int                   `json:"return_bp,omitzero" jsonschema:"result over capital; every rate here is this modified Dietz return"`
	Other     attributionPartView   `json:"other,omitzero"     jsonschema:"cash, fees and exchange"`
	Items     []attributionItemView `json:"items,omitzero"`
	Rate      attributionCompare    `json:"rate,omitzero"`
	Inflation attributionCompare    `json:"inflation,omitzero"`
}

type attributionPartView struct {
	Result         tool.Money `json:"result"`
	WeightBP       int        `json:"weight_bp"          jsonschema:"share of capital; weights add up to 10000"`
	ContributionBP int        `json:"contribution_bp"    jsonschema:"result over the year's capital; adds up to return_bp"`
	ReturnBP       int        `json:"return_bp,omitzero"`
}

type attributionItemView struct {
	Instrument string `json:"instrument"`
	attributionPartView
	StaleSince string `json:"stale_since,omitzero" jsonschema:"date of a year-end price over 14 days old; no return_bp then"`
}

type attributionCompare struct {
	Index       string     `json:"index"`
	Until       string     `json:"until"`
	ReturnBP    int        `json:"return_bp"`
	Result      tool.Money `json:"result"`
	IndexBP     int        `json:"index_bp"         jsonschema:"what the same flows earned at the index"`
	IndexResult tool.Money `json:"index_result"`
	RealBP      int        `json:"real_bp,omitzero"`
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

	v.Result, v.Capital, v.ReturnBP = tool.MoneyOf(
		*y.Result,
	), tool.MoneyOf(
		*y.Capital,
	), valueOf(
		y.ReturnBP,
	)
	v.Since = y.Since.Format(time.DateOnly)
	v.Other = attributionPartOf(*y.Other)
	v.Rate, v.Inflation = attributionCompareOf(y.Rate), attributionCompareOf(y.Inflation)

	for _, it := range y.Items {
		item := attributionItemView{
			Instrument:          string(it.Instrument),
			attributionPartView: attributionPartOf(it.AttributionPart),
		}
		if it.StaleSince != nil {
			item.StaleSince = it.StaleSince.Format(time.DateOnly)
		}

		v.Items = append(v.Items, item)
	}

	return v
}

func attributionPartOf(p app.AttributionPart) attributionPartView {
	return attributionPartView{
		Result:         tool.MoneyOf(p.Result),
		WeightBP:       p.WeightBP,
		ContributionBP: p.ContributionBP,
		ReturnBP:       valueOf(p.ReturnBP),
	}
}

func attributionCompareOf(c *app.AttributionCompare) attributionCompare {
	if c == nil {
		return attributionCompare{}
	}

	return attributionCompare{
		Index:       c.Index,
		Until:       c.Until.Format(time.DateOnly),
		ReturnBP:    c.ReturnBP,
		Result:      tool.MoneyOf(c.Result),
		IndexBP:     c.IndexBP,
		IndexResult: tool.MoneyOf(c.IndexResult),
		RealBP:      valueOf(c.RealBP),
	}
}
