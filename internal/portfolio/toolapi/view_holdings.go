package toolapi

import (
	"cmp"
	"encoding/json"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

type contributionClass struct {
	Name     string     `json:"name"`
	TargetBP int64      `json:"target_bp"`
	ShareBP  int64      `json:"share_bp"`
	AfterBP  int64      `json:"after_bp"`
	Amount   view.Money `json:"amount"`
}

type contributionData struct {
	Amount  view.Money          `json:"amount"`
	Total   view.Money          `json:"total"`
	Classes []contributionClass `json:"classes"`
}

type holdingRow struct {
	Account    string     `json:"account"`
	Instrument string     `json:"instrument"`
	Quantity   string     `json:"quantity"`
	Cost       view.Money `json:"cost"`
	Value      view.Money `json:"value"`
	ResultBP   int64      `json:"result_bp"`
	WeightBP   int64      `json:"weight_bp"`
}

type holdingsData struct {
	Rows     []holdingRow `json:"rows"`
	Cost     view.Money   `json:"cost"`
	Value    view.Money   `json:"value"`
	ResultBP int64        `json:"result_bp"`
}

type benchmarkData struct {
	Index    string `json:"index"`
	From     string `json:"from"`
	Until    string `json:"until"`
	ReturnBP int64  `json:"return_bp"`
	IndexBP  int64  `json:"index_bp"`
	ExcessBP int64  `json:"excess_bp"`
}

// contributionFormView draws the plan's classes against their targets and, when the read named an
// amount, where that amount goes and the shares after it.
func contributionFormView(
	outputs []json.RawMessage,
	_ view.Select,
	today time.Time,
) (view.Payload, error) {
	out, err := decodePortfolio(outputs[0])
	if err != nil {
		return view.Payload{}, err
	}

	data, err := contributionDataOf(out.Contribution)
	if err != nil {
		return view.Payload{}, err
	}

	rows := view.Table{
		Head: []string{
			"assistantView.col.class",
			"assistantView.col.share",
			"assistantView.col.target",
		},
		Rows: [][]view.Value{},
	}
	for _, cl := range data.Classes {
		rows.Rows = append(rows.Rows, []view.Value{
			view.TextValue(cl.Name), view.BPValue(cl.ShareBP), view.BPValue(cl.TargetBP),
		})
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.contribution.title"},
		Window:  view.Window{At: today.Format(time.DateOnly)},
		Verdict: contributionVerdict(data),
		Open:    &view.Link{Screen: "/portfolio/contribution-plan"},
		Rows:    rows,
		Data:    data,
	}, nil
}

// contributionDataOf reads the plan's total, the amount read and each class.
func contributionDataOf(c contributionView) (contributionData, error) {
	data := contributionData{Classes: []contributionClass{}}

	total, err := view.Amount(c.Total.Amount, c.Total.Currency)
	if err != nil {
		return data, err
	}

	data.Total, data.Amount = total, view.Money{Currency: total.Currency}
	if c.Amount.Currency != "" {
		if data.Amount, err = view.Amount(c.Amount.Amount, c.Amount.Currency); err != nil {
			return data, err
		}
	}

	for _, cl := range c.Classes {
		amount := view.Money{Currency: total.Currency}
		if cl.Amount.Currency != "" {
			if amount, err = view.Amount(cl.Amount.Amount, cl.Amount.Currency); err != nil {
				return data, err
			}
		}

		data.Classes = append(data.Classes, contributionClass{
			Name:     cl.Name,
			TargetBP: int64(cl.TargetBP),
			ShareBP:  int64(cl.ShareBP),
			AfterBP:  int64(cl.AfterShareBP),
			Amount:   amount,
		})
	}

	return data, nil
}

// contributionVerdict names the class that takes most of the amount, or the class furthest below
// its target when no amount was read.
func contributionVerdict(d contributionData) view.Text {
	if len(d.Classes) == 0 {
		return view.Text{Key: "assistantView.contribution.empty"}
	}

	if d.Amount.Amount > 0 {
		top := slices.MaxFunc(
			d.Classes,
			func(a, b contributionClass) int { return cmp.Compare(a.Amount.Amount, b.Amount.Amount) },
		)

		return view.Text{Key: "assistantView.contribution.verdict", Params: map[string]view.Value{
			"name": view.TextValue(
				top.Name,
			),
			"amount": view.MoneyValue(top.Amount),
			"after":  view.BPValue(top.AfterBP),
		}}
	}

	low := slices.MinFunc(
		d.Classes,
		func(a, b contributionClass) int { return cmp.Compare(a.ShareBP-a.TargetBP, b.ShareBP-b.TargetBP) },
	)

	return view.Text{Key: "assistantView.contribution.verdict_drift", Params: map[string]view.Value{
		"name": view.TextValue(low.Name), "gap": view.PointsValue(low.TargetBP - low.ShareBP),
	}}
}

// holdingsView draws each position with its result over cost and its weight, largest weight first.
func holdingsView(outputs []json.RawMessage, _ view.Select, today time.Time) (view.Payload, error) {
	out, err := decodePortfolio(outputs[0])
	if err != nil {
		return view.Payload{}, err
	}

	data := holdingsData{Rows: []holdingRow{}}
	for _, p := range out.Positions {
		row, err := holdingRowOf(p)
		if err != nil {
			return view.Payload{}, err
		}

		data.Cost = view.Money{
			Amount:   data.Cost.Amount + row.Cost.Amount,
			Currency: row.Cost.Currency,
		}
		data.Value = view.Money{
			Amount:   data.Value.Amount + row.Value.Amount,
			Currency: row.Value.Currency,
		}
		data.Rows = append(data.Rows, row)
	}

	for i := range data.Rows {
		data.Rows[i].WeightBP = view.Share(data.Rows[i].Value.Amount, data.Value.Amount)
	}

	data.ResultBP = view.Share(data.Value.Amount-data.Cost.Amount, data.Cost.Amount)
	slices.SortStableFunc(
		data.Rows,
		func(a, b holdingRow) int { return cmp.Compare(b.WeightBP, a.WeightBP) },
	)

	return view.Payload{
		Title:   view.Text{Key: "assistantView.holdings.title"},
		Window:  view.Window{At: today.Format(time.DateOnly)},
		Verdict: holdingsVerdict(data),
		Open:    &view.Link{Screen: "/portfolio"},
		Rows:    holdingsRows(data.Rows),
		Data:    data,
	}, nil
}

func holdingRowOf(p positionView) (holdingRow, error) {
	cost, err := view.Amount(p.CostBasis.Amount, p.CostBasis.Currency)
	if err != nil {
		return holdingRow{}, err
	}

	value := cost
	if p.MarketValue.Currency != "" {
		if value, err = view.Amount(p.MarketValue.Amount, p.MarketValue.Currency); err != nil {
			return holdingRow{}, err
		}
	}

	if value.Currency != cost.Currency {
		return holdingRow{}, view.ErrCurrencies
	}

	return holdingRow{
		Account:    p.AccountName,
		Instrument: p.Instrument,
		Quantity:   p.Quantity.Amount,
		Cost:       cost,
		Value:      value,
		ResultBP:   view.Share(value.Amount-cost.Amount, cost.Amount),
	}, nil
}

// holdingsVerdict gives the whole result and names the positions below their cost.
func holdingsVerdict(d holdingsData) view.Text {
	var down []string
	for _, r := range d.Rows {
		if r.ResultBP < 0 {
			down = append(down, r.Instrument)
		}
	}

	params := map[string]view.Value{
		"result": view.RateValue(d.ResultBP),
		"count":  view.CountValue(int64(len(down))),
	}

	switch len(down) {
	case 0:
		return view.Text{Key: "assistantView.holdings.verdict_none_down", Params: params}
	case 1:
		params["name"] = view.TextValue(down[0])
		return view.Text{Key: "assistantView.holdings.verdict_one_down", Params: params}
	default:
		return view.Text{Key: "assistantView.holdings.verdict_some_down", Params: params}
	}
}

func holdingsRows(rows []holdingRow) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.instrument",
			"assistantView.col.value",
			"assistantView.col.result",
			"assistantView.col.weight",
		},
		Rows: [][]view.Value{},
	}
	for _, r := range rows {
		t.Rows = append(
			t.Rows,
			[]view.Value{
				view.TextValue(r.Instrument),
				view.MoneyValue(r.Value),
				view.RateValue(r.ResultBP),
				view.BPValue(r.WeightBP),
			},
		)
	}

	return t
}

// benchmarkFormView compares the portfolio's time-weighted return with its index over one period.
func benchmarkFormView(
	outputs []json.RawMessage,
	_ view.Select,
	_ time.Time,
) (view.Payload, error) {
	out, err := decodePortfolio(outputs[0])
	if err != nil {
		return view.Payload{}, err
	}

	b := out.Benchmark
	if b.Index == "" {
		return view.Payload{}, errNoBenchmark
	}

	data := benchmarkData{
		Index:    b.Index,
		From:     b.From,
		Until:    b.Until,
		ReturnBP: int64(b.ReturnBP),
		IndexBP:  int64(b.IndexBP),
		ExcessBP: int64(b.ExcessBP),
	}
	key := "assistantView.benchmark.verdict_above"

	excess := data.ExcessBP
	if excess < 0 {
		key, excess = "assistantView.benchmark.verdict_below", -excess
	}

	index := "assistantView.index." + b.Index

	return view.Payload{
		Title: view.Text{
			Key:    "assistantView.benchmark.title",
			Params: map[string]view.Value{"index": view.TextValue(index)},
		},
		Window: view.Window{From: b.From, To: b.Until},
		Verdict: view.Text{Key: key, Params: map[string]view.Value{
			"return": view.RateValue(data.ReturnBP), "index_return": view.RateValue(data.IndexBP),
			"excess": view.PointsValue(excess), "index": view.TextValue(index),
		}},
		Open: &view.Link{Screen: "/portfolio"},
		Rows: view.Table{
			Head: []string{"assistantView.col.series", "assistantView.col.return"},
			Rows: [][]view.Value{
				{
					view.TextValue("assistantView.benchmark.portfolio"),
					view.RateValue(data.ReturnBP),
				},
				{view.TextValue(index), view.RateValue(data.IndexBP)},
			},
		},
		Data: data,
	}, nil
}
