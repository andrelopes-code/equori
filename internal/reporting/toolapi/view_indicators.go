package toolapi

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

type indicatorTile struct {
	Kind   string  `json:"kind"`
	BP     int64   `json:"bp"`
	Series []int64 `json:"series"`
}

type indicatorsData struct {
	Month string          `json:"month"`
	Tiles []indicatorTile `json:"tiles"`
}

// indicatorMonths decodes the series and splits off the current month, which is still open.
func indicatorMonths(raw json.RawMessage, today time.Time) ([]indicatorView, bool, error) {
	var out getFinancialIndicatorsOut
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, false, fmt.Errorf("decode get_financial_indicators output: %w", err)
	}

	if len(out.Months) == 0 {
		return nil, false, errNoMonths
	}

	last := out.Months[len(out.Months)-1].Month
	partial := last >= today.Format("2006-01")

	return out.Months, partial, nil
}

// closedMonths is the series without its open last month.
func closedMonths(months []indicatorView, partial bool) []indicatorView {
	if partial {
		return months[:len(months)-1]
	}

	return months
}

// indicatorsView draws the last closed month's savings rate, committed share and liquidity, each
// with its closed months as a sparkline.
func indicatorsView(
	outputs []json.RawMessage,
	_ view.Select,
	today time.Time,
) (view.Payload, error) {
	months, partial, err := indicatorMonths(outputs[0], today)
	if err != nil {
		return view.Payload{}, err
	}

	closed := closedMonths(months, partial)
	if len(closed) == 0 {
		return view.Payload{}, errNoMonths
	}

	focus := closed[len(closed)-1]
	tiles := indicatorTiles(closed)

	return view.Payload{
		Title:  view.Text{Key: "assistantView.indicators.title"},
		Window: monthWindow(focus.Month),
		Verdict: view.Text{Key: "assistantView.indicators.verdict", Params: map[string]view.Value{
			"savings":   view.BPValue(focus.SavingsRate.BP),
			"liquidity": view.BPValue(focus.Liquidity.BP),
		}},
		Prov: &view.Text{
			Key:    "assistantView.prov.months",
			Params: map[string]view.Value{"count": view.CountValue(int64(len(closed)))},
		},
		Open: &view.Link{Screen: "/reports"},
		Rows: indicatorRows(focus),
		Data: indicatorsData{Month: focus.Month, Tiles: tiles},
	}, nil
}

// indicatorTiles is the last closed month's three ratios, each with the closed months behind it.
func indicatorTiles(closed []indicatorView) []indicatorTile {
	focus := closed[len(closed)-1]
	tiles := []indicatorTile{
		{Kind: "savings", BP: focus.SavingsRate.BP},
		{Kind: "committed", BP: focus.CommittedShare.BP},
		{Kind: "liquidity", BP: focus.Liquidity.BP},
	}

	for _, m := range closed {
		tiles[0].Series = append(tiles[0].Series, m.SavingsRate.BP)
		tiles[1].Series = append(tiles[1].Series, m.CommittedShare.BP)
		tiles[2].Series = append(tiles[2].Series, m.Liquidity.BP)
	}

	return tiles
}

func indicatorRows(focus indicatorView) view.Table {
	return view.Table{
		Head: []string{"assistantView.col.indicator", "assistantView.col.value"},
		Rows: [][]view.Value{
			{
				view.TextValue("assistantView.indicators.savings"),
				view.BPValue(focus.SavingsRate.BP),
			},
			{
				view.TextValue("assistantView.indicators.committed"),
				view.BPValue(focus.CommittedShare.BP),
			},
			{
				view.TextValue("assistantView.indicators.liquidity"),
				view.BPValue(focus.Liquidity.BP),
			},
		},
	}
}

// monthWindow is the calendar month written YYYY-MM.
func monthWindow(month string) view.Window {
	first, err := time.Parse("2006-01", month)
	if err != nil {
		return view.Window{}
	}

	return view.Window{
		From: first.Format(time.DateOnly),
		To:   first.AddDate(0, 1, -1).Format(time.DateOnly),
	}
}
