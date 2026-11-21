package view

import (
	"errors"
	"slices"
)

// Charts the rows of a view can be drawn as (answer views design, V22).
var Charts = []string{"bar", "column", "line", "area", "pie"}

// The most slices a pie draws: the slots of the chart palette.
const maxPieRows = 8

// Errors of PlotOf; each names why the rows do not fit the chart (V23).
var (
	ErrChart      = errors.New("chart must be one of bar, column, line, area, pie")
	ErrPlotRows   = errors.New("the rows are too few for this chart")
	ErrPlotLabel  = errors.New("the rows have no column of names, dates or months")
	ErrPlotSeries = errors.New("the rows have no column of numbers")
	ErrPlotPie    = errors.New("a pie takes at most 8 rows and no value below zero")
)

// Plot is the drawing of a view's rows: the chart, the label column and the series columns,
// as indexes of the head (V24).
type Plot struct {
	Chart  string `json:"chart"`
	Label  int    `json:"label"`
	Series []int  `json:"series"`
}

// PlotOf chooses the columns of t that chart draws, or returns why t does not fit it (V23).
func PlotOf(t Table, chart string) (Plot, error) {
	if !slices.Contains(Charts, chart) {
		return Plot{}, ErrChart
	}

	minRows := 1
	if chart == "line" || chart == "area" {
		minRows = 2
	}

	if len(t.Rows) < minRows {
		return Plot{}, ErrPlotRows
	}

	label, ok := labelColumn(t)
	if !ok {
		return Plot{}, ErrPlotLabel
	}

	series := seriesColumns(t, label)
	if len(series) == 0 {
		return Plot{}, ErrPlotSeries
	}

	if chart == "pie" {
		series = series[:1]
		if len(t.Rows) > maxPieRows || belowZero(t, series[0]) {
			return Plot{}, ErrPlotPie
		}
	}

	return Plot{Chart: chart, Label: label, Series: series}, nil
}

func labelColumn(t Table) (int, bool) {
	for col := range t.Head {
		if every(
			t,
			col,
			func(v Value) bool { return v.Text != "" || v.Date != "" || v.Month != "" },
		) {
			return col, true
		}
	}

	return 0, false
}

// seriesColumns returns the numeric columns that share the unit of the first one.
func seriesColumns(t Table, label int) []int {
	var series []int

	first := ""
	for col := range t.Head {
		if col == label || col >= len(t.Rows[0]) {
			continue
		}

		unit := t.Rows[0][col].unit()
		if unit == "" || !every(t, col, func(v Value) bool { return v.unit() == unit }) {
			continue
		}

		if first == "" {
			first = unit
		}

		if unit == first {
			series = append(series, col)
		}
	}

	return series
}

func belowZero(t Table, col int) bool {
	return !every(t, col, func(v Value) bool { return v.number() >= 0 })
}

// every reports whether each row holds a value at col that ok accepts.
func every(t Table, col int, ok func(Value) bool) bool {
	for _, row := range t.Rows {
		if col >= len(row) || !ok(row[col]) {
			return false
		}
	}

	return true
}

// unit names the kind of a numeric value, with the currency of an amount; "" for any other value.
func (v Value) unit() string {
	switch {
	case v.Money != nil:
		return "money:" + v.Money.Currency
	case v.BP != nil:
		return "bp"
	case v.Count != nil:
		return "count"
	case v.Times != nil:
		return "times"
	case v.Rate != nil:
		return "rate"
	case v.Points != nil:
		return "points"
	}

	return ""
}

func (v Value) number() int64 {
	switch {
	case v.Money != nil:
		return v.Money.Amount
	case v.BP != nil:
		return *v.BP
	case v.Count != nil:
		return *v.Count
	case v.Times != nil:
		return *v.Times
	case v.Rate != nil:
		return *v.Rate
	case v.Points != nil:
		return *v.Points
	}

	return 0
}
