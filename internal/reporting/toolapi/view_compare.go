package toolapi

import (
	"cmp"
	"encoding/json"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

// Rows a comparison of two periods shows.
const compareLimit = 6

type comparePeriod struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type compareItem struct {
	AccountID string     `json:"account_id"`
	Name      string     `json:"name"`
	Before    view.Money `json:"before"`
	After     view.Money `json:"after"`
}

type compareData struct {
	Periods    [2]comparePeriod `json:"periods"`
	Items      []compareItem    `json:"items"`
	Difference view.Money       `json:"difference"`
}

// compareView puts two periods side by side; the earlier one is "before" whatever the handle order.
func compareView(outputs []json.RawMessage, sel view.Select, _ time.Time) (view.Payload, error) {
	periods, sides, currency, err := compareSides(outputs)
	if err != nil {
		return view.Payload{}, err
	}

	order := compareMerge(sides, currency)
	diff := compareDifference(order, currency)
	verdict := compareVerdict(order, diff)

	data := compareData{
		Periods:    periods,
		Items:      []compareItem{},
		Difference: diff,
	}
	for i, c := range order {
		if i == cmp.Or(sel.Limit, compareLimit) {
			break
		}

		data.Items = append(data.Items, *c)
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.compare.title"},
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
		Rows: compareRows(data),
		Data: data,
	}, nil
}

// compareMerge joins the categories of both periods, largest after first, ties by name.
func compareMerge(sides [2][]rankingItem, currency string) []*compareItem {
	byID := map[string]*compareItem{}
	var order []*compareItem
	for side, items := range sides {
		for _, it := range items {
			c, ok := byID[it.AccountID]
			if !ok {
				c = &compareItem{
					AccountID: it.AccountID,
					Name:      it.Name,
					Before:    view.Money{Currency: currency},
					After:     view.Money{Currency: currency},
				}
				byID[it.AccountID] = c
				order = append(order, c)
			}

			if side == 0 {
				c.Before = it.Amount
			} else {
				c.After = it.Amount
			}
		}
	}

	slices.SortStableFunc(order, func(a, b *compareItem) int {
		return cmp.Or(cmp.Compare(b.After.Amount, a.After.Amount), cmp.Compare(a.Name, b.Name))
	})

	return order
}

// compareDifference is after minus before over every category, not only the rows shown.
func compareDifference(items []*compareItem, currency string) view.Money {
	diff := view.Money{Currency: currency}
	for _, c := range items {
		diff.Amount += c.After.Amount - c.Before.Amount
	}

	return diff
}

func compareSides(outputs []json.RawMessage) ([2]comparePeriod, [2][]rankingItem, string, error) {
	var periods [2]comparePeriod
	var sides [2][]rankingItem
	var currency string

	outs := make([]getCategoryTotalsOut, 2)
	for i, raw := range outputs {
		out, err := decodeTotals(raw)
		if err != nil {
			return periods, sides, "", err
		}

		outs[i] = out
	}

	slices.SortFunc(
		outs,
		func(a, b getCategoryTotalsOut) int { return a.From.Compare(b.From.Time) },
	)

	for i, out := range outs {
		items, total, err := topLevel(out)
		if err != nil {
			return periods, sides, "", err
		}

		if currency != "" && total.Currency != "" && total.Currency != currency {
			return periods, sides, "", view.ErrCurrencies
		}

		currency = cmp.Or(currency, total.Currency)
		periods[i] = comparePeriod{
			From: out.From.Format(time.DateOnly),
			To:   out.To.Format(time.DateOnly),
		}
		sides[i] = items
	}

	return periods, sides, currency, nil
}

// compareVerdict names the difference and the category that moved most in its direction.
func compareVerdict(items []*compareItem, diff view.Money) view.Text {
	if diff.Amount == 0 || len(items) == 0 {
		return view.Text{Key: "assistantView.compare.verdict_same"}
	}

	key, sign := "assistantView.compare.verdict_more", int64(1)
	if diff.Amount < 0 {
		key, sign = "assistantView.compare.verdict_less", -1
	}

	top := items[0]
	for _, c := range items {
		if sign*(c.After.Amount-c.Before.Amount) > sign*(top.After.Amount-top.Before.Amount) {
			top = c
		}
	}

	abs := func(m view.Money) view.Money { m.Amount *= sign; return m }

	return view.Text{Key: key, Params: map[string]view.Value{
		"amount": view.MoneyValue(abs(diff)),
		"name":   view.TextValue(top.Name),
		"name_amount": view.MoneyValue(
			abs(view.Money{Amount: top.After.Amount - top.Before.Amount, Currency: diff.Currency}),
		),
	}}
}

func compareRows(d compareData) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.category",
			"assistantView.col.before",
			"assistantView.col.after",
		},
		Rows: [][]view.Value{},
	}
	for _, it := range d.Items {
		t.Rows = append(
			t.Rows,
			[]view.Value{
				view.TextValue(it.Name),
				view.MoneyValue(it.Before),
				view.MoneyValue(it.After),
			},
		)
	}

	return t
}
