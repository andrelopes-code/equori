package view

import (
	"strings"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// maxReadingRows bounds the rows of a chart the model reads back (answer views design, V37).
const maxReadingRows = 100

// Reading is a chart as the model reads it (V37): the rows the server computed, amounts as the
// read tools write them, so an answer cites a figure of the chart without computing it.
type Reading struct {
	Head    []string `json:"head"`
	Rows    [][]any  `json:"rows"`
	Average []any    `json:"average,omitempty"`
	Omitted int      `json:"rows_omitted,omitempty"`
}

type readingMoney struct {
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
}

// Reading returns the rows of p for the model: the first column "x", then one per series.
func (p Payload) Reading() *Reading {
	r := &Reading{Head: []string{"x"}, Rows: [][]any{}}
	for _, h := range p.Rows.Head[1:] {
		r.Head = append(r.Head, plainKey(h))
	}

	for i, row := range p.Rows.Rows {
		if i == maxReadingRows {
			r.Omitted = len(p.Rows.Rows) - maxReadingRows
			break
		}

		cells := make([]any, len(row))
		for j, v := range row {
			cells[j] = v.plain()
		}

		r.Rows = append(r.Rows, cells)
	}

	if p.Plot != nil {
		for _, m := range p.Plot.Marks {
			r.Average = append(r.Average, m.Value.plain())
		}
	}

	return r
}

// plain is v as a read tool writes it: a decimal amount with its currency, an integer, a date
// or a text; nil for a gap.
func (v Value) plain() any {
	switch {
	case v.Money != nil:
		code, _ := money.ParseCurrency(v.Money.Currency)
		m, _ := money.New(v.Money.Amount, code)

		return readingMoney{Amount: m.Decimal(), Currency: v.Money.Currency}
	case v.Text != "" && v.Count != nil:
		return plainKey(v.Text)
	case v.Count != nil:
		return *v.Count
	case v.Date != "":
		return v.Date
	case v.Month != "":
		return v.Month
	case v.Text != "":
		return plainKey(v.Text)
	}

	return nil
}

// plainKey writes a catalog key of the chart as its last word ("others"); any other text stays.
func plainKey(s string) string {
	if rest, ok := strings.CutPrefix(s, "assistantView.chart."); ok {
		return rest
	}

	return s
}
