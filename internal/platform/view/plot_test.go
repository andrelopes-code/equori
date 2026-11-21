package view_test

import (
	"errors"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

func TestPlotOf(t *testing.T) {
	cases := []struct {
		name   string
		table  view.Table
		chart  string
		label  int
		series []int
		err    error
	}{
		{"bars of a ranking", ranking(), "bar", 0, []int{1}, nil},
		{"line of months", months(), "line", 1, []int{0, 2}, nil},
		{"pie keeps the first series", months(), "pie", 1, []int{0}, nil},
		{"unknown chart", ranking(), "radar", 0, nil, view.ErrChart},
		{
			"no rows",
			view.Table{Head: []string{"a"}, Rows: [][]view.Value{}},
			"bar",
			0,
			nil,
			view.ErrPlotRows,
		},
		{"no label", numbersOnly(), "bar", 0, nil, view.ErrPlotLabel},
		{"no series", textOnly(), "column", 0, nil, view.ErrPlotSeries},
		{"two currencies", currencies(), "column", 0, []int{1}, nil},
		{"line of one row", oneRow(), "line", 0, nil, view.ErrPlotRows},
		{"pie below zero", negative(), "pie", 0, nil, view.ErrPlotPie},
		{"pie of nine rows", nineRows(), "pie", 0, nil, view.ErrPlotPie},
		{"column of nine rows", nineRows(), "column", 0, []int{1}, nil},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p, err := view.PlotOf(c.table, c.chart)
			if !errors.Is(err, c.err) {
				t.Fatalf("err = %v, want %v", err, c.err)
			}

			if c.err != nil {
				return
			}

			if p.Chart != c.chart || p.Label != c.label || !slices.Equal(p.Series, c.series) {
				t.Fatalf("plot = %+v, want %s %d %v", p, c.chart, c.label, c.series)
			}
		})
	}
}

func brl(n int64) view.Value { return view.MoneyValue(view.Money{Amount: n, Currency: "BRL"}) }

func usd(n int64) view.Value { return view.MoneyValue(view.Money{Amount: n, Currency: "USD"}) }

func ranking() view.Table {
	return view.Table{
		Head: []string{"category", "amount", "share"},
		Rows: [][]view.Value{
			{view.TextValue("Food"), brl(60000), view.BPValue(6000)},
			{view.TextValue("Home"), brl(40000), view.BPValue(4000)},
		},
	}
}

// The second money column shares the unit of the first; the share column does not.
func months() view.Table {
	return view.Table{
		Head: []string{"spent", "month", "earned", "share"},
		Rows: [][]view.Value{
			{brl(100), view.MonthValue("2026-09"), brl(300), view.BPValue(10)},
			{brl(200), view.MonthValue("2026-10"), brl(400), view.BPValue(20)},
		},
	}
}

func numbersOnly() view.Table {
	return view.Table{Head: []string{"a"}, Rows: [][]view.Value{{brl(1)}, {brl(2)}}}
}

func textOnly() view.Table {
	return view.Table{
		Head: []string{"a", "b"},
		Rows: [][]view.Value{{view.TextValue("x"), view.TextValue("y")}},
	}
}

func currencies() view.Table {
	return view.Table{
		Head: []string{"account", "brl", "usd"},
		Rows: [][]view.Value{
			{view.TextValue("A"), brl(1), usd(2)},
			{view.TextValue("B"), brl(3), usd(4)},
		},
	}
}

func oneRow() view.Table {
	return view.Table{
		Head: []string{"a", "b"},
		Rows: [][]view.Value{{view.DateValue("2026-10-01"), brl(1)}},
	}
}

func negative() view.Table {
	return view.Table{
		Head: []string{"a", "b"},
		Rows: [][]view.Value{{view.TextValue("x"), brl(5)}, {view.TextValue("y"), brl(-1)}},
	}
}

func nineRows() view.Table {
	t := view.Table{Head: []string{"a", "b"}, Rows: [][]view.Value{}}
	for i := range 9 {
		t.Rows = append(t.Rows, []view.Value{view.TextValue(string(rune('a' + i))), brl(int64(i))})
	}

	return t
}
