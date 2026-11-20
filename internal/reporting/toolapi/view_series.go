package toolapi

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

var errNoMonths = errors.New("the read holds no closed month")

type seriesMonth struct {
	Month   string     `json:"month"`
	Amount  view.Money `json:"amount"`
	Partial bool       `json:"partial"`
}

type seriesData struct {
	Months  []seriesMonth `json:"months"`
	Average view.Money    `json:"average"`
	// The last closed month, drawn in the accent.
	Focus string `json:"focus"`
}

// seriesView draws spending per month, the average of the closed months and the open month hatched.
func seriesView(outputs []json.RawMessage, _ view.Select, today time.Time) (view.Payload, error) {
	months, partial, err := indicatorMonths(outputs[0], today)
	if err != nil {
		return view.Payload{}, err
	}

	data := seriesData{Months: []seriesMonth{}}
	for i, m := range months {
		amount, err := view.Amount(m.Expense.Amount, m.Expense.Currency)
		if err != nil {
			return view.Payload{}, err
		}

		data.Months = append(
			data.Months,
			seriesMonth{Month: m.Month, Amount: amount, Partial: partial && i == len(months)-1},
		)
	}

	closed := data.Months
	if partial {
		closed = closed[:len(closed)-1]
	}

	if len(closed) == 0 {
		return view.Payload{}, errNoMonths
	}

	focus := closed[len(closed)-1]
	data.Focus = focus.Month
	data.Average = averageOf(closed)

	return view.Payload{
		Title: view.Text{Key: "assistantView.series.title"},
		Window: view.Window{
			From: monthWindow(months[0].Month).From,
			To:   monthWindow(months[len(months)-1].Month).To,
		},
		Verdict: seriesVerdict(closed, focus, data.Average),
		Prov: &view.Text{
			Key:    "assistantView.prov.months",
			Params: map[string]view.Value{"count": view.CountValue(int64(len(closed)))},
		},
		Open: &view.Link{Screen: "/reports"},
		Rows: seriesRows(data.Months),
		Data: data,
	}, nil
}

// averageOf is the mean of the months, rounded half to even in minor units.
func averageOf(months []seriesMonth) view.Money {
	var sum int64
	for _, m := range months {
		sum += m.Amount.Amount
	}

	n := int64(len(months))
	q, r := sum/n, sum%n
	if 2*r > n || 2*r == n && q%2 == 1 {
		q++
	}

	return view.Money{Amount: q, Currency: months[0].Amount.Currency}
}

// seriesVerdict ranks the last closed month among the closed months and names their average.
func seriesVerdict(closed []seriesMonth, focus seriesMonth, average view.Money) view.Text {
	var rank int64 = 1
	for _, m := range closed {
		if m.Amount.Amount > focus.Amount.Amount {
			rank++
		}
	}

	return view.Text{Key: "assistantView.series.verdict", Params: map[string]view.Value{
		"month":   view.MonthValue(focus.Month),
		"rank":    view.CountValue(rank),
		"average": view.MoneyValue(average),
	}}
}

func seriesRows(months []seriesMonth) view.Table {
	t := view.Table{
		Head: []string{"assistantView.col.month", "assistantView.col.spent"},
		Rows: [][]view.Value{},
	}
	for _, m := range months {
		t.Rows = append(
			t.Rows,
			[]view.Value{view.MonthValue(m.Month), view.MoneyValue(m.Amount)},
		)
	}

	return t
}
