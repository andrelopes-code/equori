package toolapi

import (
	"cmp"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

type worthPoint struct {
	Date string     `json:"date"`
	Net  view.Money `json:"net"`
}

type figureData struct {
	Net         view.Money   `json:"net"`
	Assets      view.Money   `json:"assets"`
	Liabilities view.Money   `json:"liabilities"`
	Series      []worthPoint `json:"series"`
	// The change from the first day of the series to its last; absent without a series.
	Change *view.Money `json:"change,omitempty"`
}

type allocationGroup struct {
	Key     string     `json:"key"`
	Value   view.Money `json:"value"`
	ShareBP int64      `json:"share_bp"`
}

type allocationData struct {
	Total  view.Money        `json:"total"`
	Groups []allocationGroup `json:"groups"`
}

// Views returns the builders of the portfolio reads (answer views design, V3).
func Views() map[view.Key]view.Builder {
	return map[view.Key]view.Builder{
		{Tool: "get_portfolio", Form: "figure"}:       figureView,
		{Tool: "get_portfolio", Form: "allocation"}:   allocationFormView,
		{Tool: "get_portfolio", Form: "contribution"}: contributionFormView,
		{Tool: "get_portfolio", Form: "holdings"}:     holdingsView,
		{Tool: "get_portfolio", Form: "benchmark"}:    benchmarkFormView,
		{Tool: "get_tax_year", Form: "tax_year"}:      taxYearView,
	}
}

func decodePortfolio(raw json.RawMessage) (getPortfolioOut, error) {
	var out getPortfolioOut
	if err := json.Unmarshal(raw, &out); err != nil {
		return out, fmt.Errorf("decode get_portfolio output: %w", err)
	}

	return out, nil
}

// figureView reads net worth, from a net_worth read, a net_worth_days read, or both.
func figureView(outputs []json.RawMessage, _ view.Select, today time.Time) (view.Payload, error) {
	var data figureData

	for _, raw := range outputs {
		out, err := decodePortfolio(raw)
		if err != nil {
			return view.Payload{}, err
		}

		if err := addWorth(&data, out); err != nil {
			return view.Payload{}, err
		}
	}

	if data.Net.Currency == "" {
		return view.Payload{}, fmt.Errorf(
			"the reads hold no net worth; read get_portfolio with view net_worth",
		)
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.figure.title"},
		Window:  view.Window{At: today.Format(time.DateOnly)},
		Verdict: figureVerdict(data),
		Open:    &view.Link{Screen: "/"},
		Rows: view.Table{
			Head: []string{"assistantView.col.part", "assistantView.col.value"},
			Rows: [][]view.Value{
				{view.TextValue("assistantView.figure.assets"), view.MoneyValue(data.Assets)},
				{
					view.TextValue("assistantView.figure.liabilities"),
					view.MoneyValue(data.Liabilities),
				},
				{view.TextValue("assistantView.figure.net"), view.MoneyValue(data.Net)},
			},
		},
		Data: data,
	}, nil
}

// addWorth takes the parts of a net_worth read and the series of a net_worth_days read.
func addWorth(d *figureData, out getPortfolioOut) error {
	if out.Net.Currency != "" {
		for _, p := range []struct {
			to  *view.Money
			src string
			cur string
		}{{&d.Net, out.Net.Amount, out.Net.Currency}, {&d.Assets, out.Assets.Amount, out.Assets.Currency}, {&d.Liabilities, out.Liabilities.Amount, out.Liabilities.Currency}} {
			m, err := view.Amount(p.src, p.cur)
			if err != nil {
				return err
			}

			*p.to = m
		}
	}

	for _, day := range out.Days {
		m, err := view.Amount(day.Net.Amount, day.Net.Currency)
		if err != nil {
			return err
		}

		d.Series = append(d.Series, worthPoint{Date: day.Date.Format(time.DateOnly), Net: m})
	}

	if n := len(d.Series); n > 1 {
		change := view.Money{
			Amount:   d.Series[n-1].Net.Amount - d.Series[0].Net.Amount,
			Currency: d.Series[0].Net.Currency,
		}
		d.Change = &change

		if d.Net.Currency == "" {
			d.Net = d.Series[n-1].Net
		}
	}

	return nil
}

func figureVerdict(d figureData) view.Text {
	if d.Change == nil {
		return view.Text{
			Key:    "assistantView.figure.verdict",
			Params: map[string]view.Value{"net": view.MoneyValue(d.Net)},
		}
	}

	key := "assistantView.figure.verdict_up"

	change := *d.Change
	if change.Amount < 0 {
		key, change.Amount = "assistantView.figure.verdict_down", -change.Amount
	}

	return view.Text{Key: key, Params: map[string]view.Value{
		"change": view.MoneyValue(change),
		"days":   view.CountValue(int64(len(d.Series) - 1)),
		"share":  view.BPValue(view.Share(change.Amount, d.Series[0].Net.Amount)),
	}}
}

// allocationFormView draws the groups of an allocation read, largest share first; a group key is
// an instrument type, a currency or an institution, as the read's by chose.
func allocationFormView(
	outputs []json.RawMessage,
	_ view.Select,
	today time.Time,
) (view.Payload, error) {
	out, err := decodePortfolio(outputs[0])
	if err != nil {
		return view.Payload{}, err
	}

	data, err := allocationDataOf(out)
	if err != nil {
		return view.Payload{}, err
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.allocation.title"},
		Window:  view.Window{At: today.Format(time.DateOnly)},
		Verdict: allocationVerdict(data),
		Open:    &view.Link{Screen: "/portfolio"},
		Rows:    allocationRows(data.Groups),
		Data:    data,
	}, nil
}

// allocationDataOf reads the total and the groups, largest share first.
func allocationDataOf(out getPortfolioOut) (allocationData, error) {
	total, err := view.Amount(out.Total.Amount, out.Total.Currency)
	if err != nil {
		return allocationData{}, err
	}

	data := allocationData{Total: total, Groups: []allocationGroup{}}
	for _, g := range out.Groups {
		v, err := view.Amount(g.Value.Amount, g.Value.Currency)
		if err != nil {
			return allocationData{}, err
		}

		data.Groups = append(
			data.Groups,
			allocationGroup{Key: g.Key, Value: v, ShareBP: int64(g.ShareBP)},
		)
	}

	slices.SortStableFunc(data.Groups, func(a, b allocationGroup) int {
		return cmp.Compare(b.ShareBP, a.ShareBP)
	})

	return data, nil
}

func allocationVerdict(d allocationData) view.Text {
	if len(d.Groups) == 0 {
		return view.Text{Key: "assistantView.allocation.empty"}
	}

	return view.Text{Key: "assistantView.allocation.verdict", Params: map[string]view.Value{
		"name":  view.TextValue(groupLabel(d.Groups[0].Key)),
		"share": view.BPValue(d.Groups[0].ShareBP),
		"total": view.MoneyValue(d.Total),
	}}
}

func allocationRows(groups []allocationGroup) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.group",
			"assistantView.col.value",
			"assistantView.col.share",
		},
		Rows: [][]view.Value{},
	}
	for _, g := range groups {
		t.Rows = append(t.Rows, []view.Value{
			view.TextValue(groupLabel(g.Key)), view.MoneyValue(g.Value), view.BPValue(g.ShareBP),
		})
	}

	return t
}

// groupLabel names a group: a catalog key for an instrument type, the key itself for a currency or
// an institution, which the client writes as given.
func groupLabel(key string) string {
	if len(key) == 3 && key == strings.ToUpper(key) {
		return key
	}

	return "assistantView.group." + key
}
