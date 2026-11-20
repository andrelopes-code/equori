package toolapi

import (
	"encoding/json"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/platform/view"
)

type waterfallStep struct {
	// start, income, expense, other or end.
	Kind   string     `json:"kind"`
	Amount view.Money `json:"amount"`
}

type waterfallData struct {
	Month string          `json:"month"`
	Steps []waterfallStep `json:"steps"`
}

// waterfallView walks the last closed month from the liquid balance at its start to the one at
// its end: income, expense, and the other movements (transfers to investments, adjustments) that
// close the walk, written even when zero.
func waterfallView(
	outputs []json.RawMessage,
	_ view.Select,
	today time.Time,
) (view.Payload, error) {
	months, partial, err := indicatorMonths(outputs[0], today)
	if err != nil {
		return view.Payload{}, err
	}

	closed := closedMonths(months, partial)
	if len(closed) < 2 {
		return view.Payload{}, errNoMonths
	}

	focus := closed[len(closed)-1]

	steps, err := waterfallSteps(closed[len(closed)-2], focus)
	if err != nil {
		return view.Payload{}, err
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.waterfall.title"},
		Window:  monthWindow(focus.Month),
		Verdict: waterfallVerdict(steps),
		Open:    &view.Link{Screen: "/reports"},
		Rows:    waterfallRows(steps),
		Data:    waterfallData{Month: focus.Month, Steps: steps},
	}, nil
}

// waterfallSteps reads the five steps of the walk; the expense step is negative.
func waterfallSteps(prev, focus indicatorView) ([]waterfallStep, error) {
	amounts := make([]view.Money, 4)
	for i, m := range []tool.Money{prev.LiquidBalance, focus.Income, focus.Expense, focus.LiquidBalance} {
		a, err := view.Amount(m.Amount, m.Currency)
		if err != nil {
			return nil, err
		}

		if i > 0 && a.Currency != amounts[0].Currency {
			return nil, view.ErrCurrencies
		}

		amounts[i] = a
	}

	start, income, expense, end := amounts[0], amounts[1], amounts[2], amounts[3]
	other := view.Money{
		Amount:   end.Amount - start.Amount - income.Amount + expense.Amount,
		Currency: start.Currency,
	}
	expense.Amount = -expense.Amount

	return []waterfallStep{
		{"start", start}, {"income", income}, {"expense", expense}, {"other", other}, {"end", end},
	}, nil
}

// waterfallVerdict names what the month saved, or what it spent beyond its income.
func waterfallVerdict(steps []waterfallStep) view.Text {
	income, expense := steps[1].Amount, steps[2].Amount
	saved := view.Money{Amount: income.Amount + expense.Amount, Currency: income.Currency}

	key := "assistantView.waterfall.verdict_saved"
	if saved.Amount < 0 {
		key, saved.Amount = "assistantView.waterfall.verdict_short", -saved.Amount
	}

	return view.Text{Key: key, Params: map[string]view.Value{
		"amount":  view.MoneyValue(saved),
		"income":  view.MoneyValue(income),
		"expense": view.MoneyValue(view.Money{Amount: -expense.Amount, Currency: expense.Currency}),
	}}
}

func waterfallRows(steps []waterfallStep) view.Table {
	t := view.Table{
		Head: []string{"assistantView.col.step", "assistantView.col.value"},
		Rows: [][]view.Value{},
	}
	for _, s := range steps {
		t.Rows = append(
			t.Rows,
			[]view.Value{
				view.TextValue("assistantView.waterfall." + s.Kind),
				view.MoneyValue(s.Amount),
			},
		)
	}

	return t
}
