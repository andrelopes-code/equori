package viewapi

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

var errManyMonths = errors.New(
	"the search spans more than one month; read one month for a heat view",
)

type heatData struct {
	Month string       `json:"month"`
	Days  []view.Money `json:"days"`
	// The last day with spending to count: today in the current month, the month's last day before.
	Until int `json:"until"`
	Peak  int `json:"peak"`
}

// heatView sums each day's spending of one month, for a calendar.
func heatView(outputs []json.RawMessage, _ view.Select, today time.Time) (view.Payload, error) {
	txs, err := searchPages(outputs)
	if err != nil {
		return view.Payload{}, err
	}

	if len(txs) == 0 {
		return view.Payload{
			Title:   view.Text{Key: "assistantView.heat.title"},
			Verdict: view.Text{Key: "assistantView.txs.empty"},
			Rows:    view.Table{Head: []string{}, Rows: [][]view.Value{}},
			Data:    heatData{Days: []view.Money{}},
		}, nil
	}

	first := time.Date(txs[0].Date.Year(), txs[0].Date.Month(), 1, 0, 0, 0, 0, time.UTC)

	data, err := heatDays(txs, first, today)
	if err != nil {
		return view.Payload{}, err
	}

	last := first.AddDate(0, 1, -1).Format(time.DateOnly)

	return view.Payload{
		Title:   view.Text{Key: "assistantView.heat.title"},
		Window:  view.Window{From: first.Format(time.DateOnly), To: last},
		Verdict: heatVerdict(data, first),
		Open: &view.Link{
			Screen: "/transactions",
			Params: map[string]string{"from": first.Format(time.DateOnly), "to": last},
		},
		Rows: heatRows(data, first),
		Data: data,
	}, nil
}

// heatDays sums the spending of each day of the month that starts at first, and finds the peak.
func heatDays(txs []transactionView, first, today time.Time) (heatData, error) {
	days := first.AddDate(0, 1, -1).Day()
	data := heatData{Month: first.Format("2006-01"), Days: make([]view.Money, days), Until: days}

	if today.Year() == first.Year() && today.Month() == first.Month() {
		data.Until = today.Day()
	}

	for _, t := range txs {
		if t.Date.Year() != first.Year() || t.Date.Month() != first.Month() {
			return heatData{}, errManyMonths
		}

		it, err := txItemOf(t)
		if err != nil {
			return heatData{}, err
		}

		if it.Category != "" && it.Amount.Amount < 0 && !t.Voided {
			d := &data.Days[t.Date.Day()-1]
			d.Amount -= it.Amount.Amount
			d.Currency = it.Amount.Currency
		}
	}

	for i, d := range data.Days {
		if data.Peak == 0 || d.Amount > data.Days[data.Peak-1].Amount {
			data.Peak = i + 1
		}
	}

	return data, nil
}

func heatVerdict(d heatData, first time.Time) view.Text {
	peak := d.Days[d.Peak-1]
	if peak.Amount == 0 {
		return view.Text{Key: "assistantView.txs.empty"}
	}

	return view.Text{Key: "assistantView.heat.verdict", Params: map[string]view.Value{
		"day":    view.DateValue(first.AddDate(0, 0, d.Peak-1).Format(time.DateOnly)),
		"amount": view.MoneyValue(peak),
	}}
}

func heatRows(d heatData, first time.Time) view.Table {
	t := view.Table{
		Head: []string{"assistantView.col.date", "assistantView.col.spent"},
		Rows: [][]view.Value{},
	}
	for i, m := range d.Days {
		if m.Amount != 0 {
			day := first.AddDate(0, 0, i).Format(time.DateOnly)
			t.Rows = append(t.Rows, []view.Value{view.DateValue(day), view.MoneyValue(m)})
		}
	}

	return t
}
