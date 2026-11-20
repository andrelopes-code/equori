package toolapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

var errNoBenchmark = errors.New("the read holds no benchmark; read get_portfolio with view return")

type taxMonth struct {
	Month  string     `json:"month"`
	Result view.Money `json:"result"`
	Exempt view.Money `json:"exempt"`
	Tax    view.Money `json:"tax"`
	Due    view.Money `json:"due"`
}

type taxYearData struct {
	From   string     `json:"from"`
	To     string     `json:"to"`
	Months []taxMonth `json:"months"`
	Total  view.Money `json:"total"`
}

// taxYearView draws the monthly result of sales and the tax each month owes (gain_tax view): the
// region's rules decided the exemption and the rate, the view only adds the months up.
func taxYearView(outputs []json.RawMessage, _ view.Select, _ time.Time) (view.Payload, error) {
	var out getTaxYearOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return view.Payload{}, fmt.Errorf("decode get_tax_year output: %w", err)
	}

	data := taxYearData{
		From:   out.From.Format(time.DateOnly),
		To:     out.To.Format(time.DateOnly),
		Months: []taxMonth{},
	}
	rows := view.Table{
		Head: []string{
			"assistantView.col.month",
			"assistantView.col.result",
			"assistantView.col.tax",
		},
		Rows: [][]view.Value{},
	}

	for _, m := range out.GainTax {
		month, err := taxMonthOf(m)
		if err != nil {
			return view.Payload{}, err
		}

		data.Total = view.Money{
			Amount:   data.Total.Amount + month.Due.Amount,
			Currency: month.Due.Currency,
		}
		data.Months = append(data.Months, month)
		rows.Rows = append(
			rows.Rows,
			[]view.Value{
				view.MonthValue(month.Month),
				view.MoneyValue(month.Result),
				view.MoneyValue(month.Due),
			},
		)
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.tax_year.title"},
		Window:  view.Window{From: data.From, To: data.To},
		Verdict: taxVerdict(data),
		Open:    &view.Link{Screen: "/portfolio"},
		Rows:    rows,
		Data:    data,
	}, nil
}

// taxMonthOf adds the pools of one month; the amount due is the month's DARF.
func taxMonthOf(m gainTaxMonthView) (taxMonth, error) {
	due, err := view.Amount(m.Darf.Amount, m.Darf.Currency)
	if err != nil {
		return taxMonth{}, err
	}

	month := taxMonth{
		Month:  m.Month,
		Due:    due,
		Result: view.Money{Currency: due.Currency},
		Exempt: view.Money{Currency: due.Currency},
		Tax:    view.Money{Currency: due.Currency},
	}
	for _, l := range m.Lines {
		for _, p := range []struct {
			to  *view.Money
			src string
		}{{&month.Result, l.Result.Amount}, {&month.Exempt, l.Exempt.Amount}, {&month.Tax, l.Tax.Amount}} {
			v, err := view.Amount(p.src, due.Currency)
			if err != nil {
				return taxMonth{}, err
			}

			p.to.Amount += v.Amount
		}
	}

	return month, nil
}

func taxVerdict(d taxYearData) view.Text {
	var count int64
	for _, m := range d.Months {
		if m.Due.Amount > 0 {
			count++
		}
	}

	if count == 0 {
		return view.Text{Key: "assistantView.tax_year.verdict_none"}
	}

	return view.Text{Key: "assistantView.tax_year.verdict", Params: map[string]view.Value{
		"count": view.CountValue(count),
		"total": view.MoneyValue(d.Total),
	}}
}
