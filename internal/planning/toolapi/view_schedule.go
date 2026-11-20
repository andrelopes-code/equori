package toolapi

import (
	"cmp"
	"encoding/json"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

type agendaEvent struct {
	Date        string     `json:"date"`
	Description string     `json:"description"`
	Account     string     `json:"account,omitempty"`
	Amount      view.Money `json:"amount"`
	State       string     `json:"state"`
}

type agendaWeek struct {
	// Monday of the week (ISO 8601).
	Start  string        `json:"start"`
	Total  view.Money    `json:"total"`
	Events []agendaEvent `json:"events"`
}

type agendaData struct {
	Total view.Money   `json:"total"`
	Weeks []agendaWeek `json:"weeks"`
}

// agendaView groups the expected occurrences by week, with each week's total.
func agendaView(outputs []json.RawMessage, _ view.Select, _ time.Time) (view.Payload, error) {
	var out listSchedulesOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return view.Payload{}, fmt.Errorf("decode list_schedules output: %w", err)
	}

	accounts := map[string]string{}
	for _, s := range out.Schedules {
		accounts[s.ScheduleID] = s.AccountName
	}

	data := agendaData{Weeks: []agendaWeek{}}
	for _, o := range out.Occurrences {
		m, err := view.Amount(o.ExpectedAmount.Amount, o.ExpectedAmount.Currency)
		if err != nil {
			return view.Payload{}, err
		}

		if data.Total.Currency != "" && m.Currency != data.Total.Currency {
			return view.Payload{}, view.ErrCurrencies
		}

		data.Total = view.Money{Amount: data.Total.Amount + m.Amount, Currency: m.Currency}
		addToWeek(&data, o.ExpectedOn.Time, agendaEvent{
			Date:        o.ExpectedOn.Format(time.DateOnly),
			Description: o.Description,
			Account:     accounts[o.ScheduleID],
			Amount:      m,
			State:       o.State,
		})
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.agenda.title"},
		Window:  agendaWindow(data.Weeks),
		Verdict: agendaVerdict(data, len(out.Occurrences)),
		Open:    &view.Link{Screen: "/planning", Params: map[string]string{"tab": "agenda"}},
		Rows:    agendaRows(data.Weeks),
		Data:    data,
	}, nil
}

// addToWeek appends the event to its week, opening the week when it is the first of it.
func addToWeek(d *agendaData, date time.Time, e agendaEvent) {
	monday := date.AddDate(0, 0, -((int(date.Weekday()) + 6) % 7)).Format(time.DateOnly)

	i := slices.IndexFunc(d.Weeks, func(w agendaWeek) bool { return w.Start == monday })
	if i < 0 {
		d.Weeks = append(
			d.Weeks,
			agendaWeek{Start: monday, Total: view.Money{Currency: e.Amount.Currency}},
		)
		i = len(d.Weeks) - 1
	}

	d.Weeks[i].Total.Amount += e.Amount.Amount
	d.Weeks[i].Events = append(d.Weeks[i].Events, e)
}

func agendaWindow(weeks []agendaWeek) view.Window {
	if len(weeks) == 0 {
		return view.Window{}
	}

	last := weeks[len(weeks)-1].Events

	return view.Window{From: weeks[0].Events[0].Date, To: last[len(last)-1].Date}
}

// agendaVerdict names the total and the week that holds the most.
func agendaVerdict(d agendaData, count int) view.Text {
	if count == 0 {
		return view.Text{Key: "assistantView.agenda.empty"}
	}

	top := slices.MinFunc(
		d.Weeks,
		func(a, b agendaWeek) int { return cmp.Compare(a.Total.Amount, b.Total.Amount) },
	)

	return view.Text{Key: "assistantView.agenda.verdict", Params: map[string]view.Value{
		"total":      view.MoneyValue(d.Total),
		"count":      view.CountValue(int64(count)),
		"week":       view.DateValue(top.Start),
		"week_total": view.MoneyValue(top.Total),
	}}
}

func agendaRows(weeks []agendaWeek) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.date",
			"assistantView.col.name",
			"assistantView.col.amount",
		},
		Rows: [][]view.Value{},
	}
	for _, w := range weeks {
		for _, e := range w.Events {
			t.Rows = append(
				t.Rows,
				[]view.Value{
					view.DateValue(e.Date),
					view.TextValue(e.Description),
					view.MoneyValue(e.Amount),
				},
			)
		}
	}

	return t
}
