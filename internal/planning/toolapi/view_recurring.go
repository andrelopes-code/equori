package toolapi

import (
	"cmp"
	"encoding/json"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

// Charges a year of each cadence of find_recurring (planning domain, series cadences).
var chargesPerYear = map[string]int64{"weekly": 52, "monthly": 12, "quarterly": 4, "yearly": 1}

type recurringItem struct {
	Key       string     `json:"key"`
	Name      string     `json:"name"`
	Account   string     `json:"account"`
	Frequency string     `json:"frequency"`
	Last      view.Money `json:"last"`
	LastDate  string     `json:"last_date"`
	NextDate  string     `json:"next_date"`
	Yearly    view.Money `json:"yearly"`
	Scheduled bool       `json:"scheduled"`
}

type recurringData struct {
	Total view.Money      `json:"total"`
	Items []recurringItem `json:"items"`
}

// recurringView lists the charges that repeat, each with what it costs in a year: the last
// amount times the charges a year of its cadence; the largest cost first.
func recurringView(outputs []json.RawMessage, _ view.Select, _ time.Time) (view.Payload, error) {
	var out findRecurringOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return view.Payload{}, fmt.Errorf("decode find_recurring output: %w", err)
	}

	data := recurringData{Items: []recurringItem{}}
	for _, s := range out.Series {
		last, err := view.Amount(s.LastAmount.Amount, s.LastAmount.Currency)
		if err != nil {
			return view.Payload{}, err
		}

		if data.Total.Currency != "" && last.Currency != data.Total.Currency {
			return view.Payload{}, view.ErrCurrencies
		}

		yearly := view.Money{
			Amount:   last.Amount * chargesPerYear[s.Frequency],
			Currency: last.Currency,
		}
		data.Total = view.Money{Amount: data.Total.Amount + yearly.Amount, Currency: last.Currency}
		data.Items = append(data.Items, recurringItem{
			Key:       s.Key,
			Name:      cmp.Or(s.Payee, s.Key),
			Account:   s.Account,
			Frequency: s.Frequency,
			Last:      last,
			LastDate:  s.LastDate.Format(time.DateOnly),
			NextDate:  s.NextDate.Format(time.DateOnly),
			Yearly:    yearly,
			Scheduled: s.ScheduleID != "",
		})
	}

	slices.SortStableFunc(
		data.Items,
		func(a, b recurringItem) int { return cmp.Compare(a.Yearly.Amount, b.Yearly.Amount) },
	)

	return view.Payload{
		Title:   view.Text{Key: "assistantView.recurring.title"},
		Verdict: recurringVerdict(data),
		Open:    &view.Link{Screen: "/planning", Params: map[string]string{"tab": "subscriptions"}},
		Rows:    recurringRows(data.Items),
		Data:    data,
	}, nil
}

func recurringVerdict(d recurringData) view.Text {
	if len(d.Items) == 0 {
		return view.Text{Key: "assistantView.recurring.empty"}
	}

	return view.Text{Key: "assistantView.recurring.verdict", Params: map[string]view.Value{
		"count": view.CountValue(int64(len(d.Items))),
		"total": view.MoneyValue(view.Money{Amount: -d.Total.Amount, Currency: d.Total.Currency}),
	}}
}

func recurringRows(items []recurringItem) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.name",
			"assistantView.col.amount",
			"assistantView.col.yearly",
		},
		Rows: [][]view.Value{},
	}
	for _, it := range items {
		t.Rows = append(
			t.Rows,
			[]view.Value{
				view.TextValue(it.Name),
				view.MoneyValue(it.Last),
				view.MoneyValue(it.Yearly),
			},
		)
	}

	return t
}
