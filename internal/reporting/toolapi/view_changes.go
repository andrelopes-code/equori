package toolapi

import (
	"cmp"
	"encoding/json"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

type changesItem struct {
	AccountID string     `json:"account_id"`
	Name      string     `json:"name"`
	Delta     view.Money `json:"delta"`
}

type changesData struct {
	Periods    [2]comparePeriod `json:"periods"`
	Items      []changesItem    `json:"items"`
	Difference view.Money       `json:"difference"`
}

// changesView draws what moved between two periods: each category's difference, largest rise first.
func changesView(outputs []json.RawMessage, sel view.Select, _ time.Time) (view.Payload, error) {
	periods, sides, currency, err := compareSides(outputs)
	if err != nil {
		return view.Payload{}, err
	}

	order := compareMerge(sides, currency)
	diff := compareDifference(order, currency)

	items := make([]changesItem, 0, len(order))
	for _, c := range order {
		d := view.Money{Amount: c.After.Amount - c.Before.Amount, Currency: currency}
		if d.Amount != 0 {
			items = append(items, changesItem{AccountID: c.AccountID, Name: c.Name, Delta: d})
		}
	}

	slices.SortStableFunc(items, func(a, b changesItem) int {
		return cmp.Or(cmp.Compare(b.Delta.Amount, a.Delta.Amount), cmp.Compare(a.Name, b.Name))
	})

	verdict := changesVerdict(items, diff)

	if limit := cmp.Or(sel.Limit, compareLimit); len(items) > limit {
		items = items[:limit]
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.changes.title"},
		Window:  view.Window{From: periods[0].From, To: periods[1].To},
		Verdict: verdict,
		Prov: &view.Text{
			Key:    "assistantView.prov.categories",
			Params: map[string]view.Value{"count": view.CountValue(int64(len(order)))},
		},
		Open: &view.Link{
			Screen: "/reports",
			Params: map[string]string{"from": periods[1].From, "to": periods[1].To},
		},
		Rows: changesRows(items),
		Data: changesData{Periods: periods, Items: items, Difference: diff},
	}, nil
}

// changesVerdict names the total change and how much of it the two largest moves in its direction make.
func changesVerdict(items []changesItem, diff view.Money) view.Text {
	if diff.Amount == 0 {
		return view.Text{Key: "assistantView.compare.verdict_same"}
	}

	key, sign := "assistantView.changes.verdict_more", int64(1)
	if diff.Amount < 0 {
		key, sign = "assistantView.changes.verdict_less", -1
	}

	moves := slices.Clone(items)
	slices.SortStableFunc(
		moves,
		func(a, b changesItem) int { return cmp.Compare(sign*b.Delta.Amount, sign*a.Delta.Amount) },
	)

	top := view.Money{Currency: diff.Currency}
	names := []string{}
	for _, m := range moves[:min(2, len(moves))] {
		if sign*m.Delta.Amount > 0 {
			top.Amount += sign * m.Delta.Amount
			names = append(names, m.Name)
		}
	}

	params := map[string]view.Value{
		"amount": view.MoneyValue(view.Money{Amount: sign * diff.Amount, Currency: diff.Currency}),
		"top":    view.MoneyValue(top),
		"first":  view.TextValue(names[0]),
	}
	if len(names) == 1 {
		return view.Text{Key: key + "_one", Params: params}
	}

	params["second"] = view.TextValue(names[1])

	return view.Text{Key: key, Params: params}
}

func changesRows(items []changesItem) view.Table {
	t := view.Table{
		Head: []string{"assistantView.col.category", "assistantView.col.change"},
		Rows: [][]view.Value{},
	}
	for _, it := range items {
		t.Rows = append(t.Rows, []view.Value{view.TextValue(it.Name), view.MoneyValue(it.Delta)})
	}

	return t
}
