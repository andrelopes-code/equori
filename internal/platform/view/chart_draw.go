package view

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
)

// Catalog keys of the chart view (V35).
const (
	chartTitleKey   = "assistantView.chart.title"
	chartProvKey    = "assistantView.chart.prov"
	chartTotalKey   = "assistantView.chart.verdict_total"
	chartRangeKey   = "assistantView.chart.verdict_range"
	chartEmptyKey   = "assistantView.chart.verdict_empty"
	chartPeriodHead = "assistantView.chart.period"
	chartItemHead   = "assistantView.chart.item"
)

// drawChart turns the groups into the rows, the plot and the texts of the view (V34, V35).
func drawChart(g *chartGroups, spec ChartSpec, count int) (Payload, error) {
	base := g.values(spec)

	// The verdict reads the aggregates and their units before a derivation changes them (V38).
	verdict := g.verdict(spec, base)

	values, err := g.derive(spec, base)
	if err != nil {
		return Payload{}, err
	}

	if err := g.check(spec, values); err != nil {
		return Payload{}, err
	}

	head := spec.X.Label
	if head == "" && g.dated {
		head = chartPeriodHead
	} else if head == "" {
		head = chartItemHead
	}

	table := Table{Head: append([]string{head}, g.heads...), Rows: make([][]Value, len(g.rows))}
	for i, row := range g.rows {
		table.Rows[i] = append([]Value{row.label}, values[i]...)
	}

	plot := g.plot(spec, values)

	return Payload{
		Title:   Text{Key: chartTitleKey, Params: map[string]Value{"title": TextValue(spec.Title)}},
		Window:  g.window(spec.X),
		Verdict: verdict,
		Prov: &Text{
			Key:    chartProvKey,
			Params: map[string]Value{"count": CountValue(int64(count))},
		},
		Rows: table,
		Plot: &plot,
		Data: map[string]any{},
	}, nil
}

// values is the aggregate of every row and column as a typed value; an empty value is a gap.
func (g *chartGroups) values(spec ChartSpec) [][]Value {
	out := make([][]Value, len(g.rows))
	for i, row := range g.rows {
		out[i] = make([]Value, len(row.accs))
		for j, a := range row.accs {
			if v, ok := a.result(spec.Series[g.series[j]].Agg, spec.sums()); ok {
				out[i][j] = g.typedValue(j, v)
			}
		}
	}

	return out
}

func (g *chartGroups) typedValue(col int, v int64) Value {
	if cur, ok := strings.CutPrefix(g.units[col], "money:"); ok {
		return MoneyValue(Money{Amount: v, Currency: cur})
	}

	return CountValue(v)
}

// check applies the drawing rules of V34.
func (g *chartGroups) check(spec ChartSpec, values [][]Value) error {
	if spec.Series[0].Kind == "pie" {
		if len(g.rows) > pieLimit || slices.ContainsFunc(values, func(r []Value) bool {
			return r[0].number() < 0
		}) {
			return errors.New("pie: at most 8 rows and no value below zero; use bars")
		}
	}

	axes := map[string]string{}

	for col, unit := range g.units {
		se := spec.Series[g.series[col]]
		axis := axisOf(se)

		if u, ok := axes[axis]; ok && u != unit {
			return fmt.Errorf(
				"series: one axis holds one unit; %s and %s need axis start and end",
				unitName(u), unitName(unit),
			)
		}

		axes[axis] = unit

		if err := checkSeries(spec, se); err != nil {
			return err
		}
	}

	return nil
}

func checkSeries(spec ChartSpec, se ChartSeries) error {
	switch {
	case se.Kind == "pie" && len(spec.Series) > 1:
		return errors.New("pie: draws one series alone")
	case se.Stack && se.Kind != "bar" && se.Kind != "area":
		return errors.New("stack: applies to bar and area series")
	case spec.Orientation == "horizontal" && se.Kind != "bar":
		return errors.New("orientation horizontal: every series is a bar")
	}

	for _, a := range spec.Average {
		s := spec.Series[a]
		if s.Kind == "pie" || (s.Agg != "sum" && s.Agg != "count") {
			return errors.New("average: of a bar, line or area series that sums or counts")
		}
	}

	return nil
}

func axisOf(se ChartSeries) string {
	if se.Axis == "end" {
		return "end"
	}

	return "start"
}

func (g *chartGroups) plot(spec ChartSpec, values [][]Value) Plot {
	p := Plot{
		Orientation: spec.Orientation,
		StackMode:   spec.StackMode,
		Series:      make([]PlotSeries, len(g.heads)),
		Marks:       []PlotMark{},
	}

	for col := range g.heads {
		se := spec.Series[g.series[col]]

		axis := ""
		if se.Axis == "end" {
			axis = "end"
		}

		p.Series[col] = PlotSeries{
			Column: col + 1,
			Kind:   se.Kind,
			Axis:   axis,
			Stack:  se.Stack,
			Curve:  se.Curve,
			Tone:   se.Tone,
		}

		if slices.Contains(spec.Average, g.series[col]) {
			p.Marks = append(p.Marks, g.average(col, values))
		}
	}

	return p
}

// average is the mean of a column over its rows, rounded half to even.
func (g *chartGroups) average(col int, values [][]Value) PlotMark {
	var sum, n int64
	for _, r := range values {
		sum += r[col].number()
		n++
	}

	return PlotMark{Kind: "average", Column: col + 1, Value: g.typedValue(col, roundDiv(sum, n))}
}

// verdict names the total and the largest row, or the range of a series that does not sum.
func (g *chartGroups) verdict(spec ChartSpec, values [][]Value) Text {
	if !spec.sums() {
		return g.rangeVerdict(values)
	}

	cols := 1
	if spec.Split != nil {
		cols = len(g.heads)
	}

	var total int64

	top, topValue := 0, int64(0)
	for i, r := range values {
		var t int64
		for _, v := range r[:cols] {
			t += v.number()
		}

		total += t
		if i == 0 || t > topValue {
			top, topValue = i, t
		}
	}

	if total == 0 && topValue == 0 {
		return Text{Key: chartEmptyKey}
	}

	return Text{Key: chartTotalKey, Params: map[string]Value{
		"total": g.typedValue(0, total),
		"label": g.rows[top].label,
		"top":   g.typedValue(0, topValue),
	}}
}

func (g *chartGroups) rangeVerdict(values [][]Value) Text {
	var low, high *Value
	for _, r := range values {
		v := r[0]
		if v.unit() == "" {
			continue
		}

		if low == nil || v.number() < low.number() {
			low = &v
		}

		if high == nil || v.number() > high.number() {
			high = &v
		}
	}

	if low == nil {
		return Text{Key: chartEmptyKey}
	}

	return Text{Key: chartRangeKey, Params: map[string]Value{"low": *low, "high": *high}}
}

// window is the first and last day the rows cover, or x.from and x.to of a text x.
func (g *chartGroups) window(x ChartX) Window {
	if !g.dated {
		return Window{From: x.From, To: x.To}
	}

	keys := make([]string, len(g.rows))
	for i, row := range g.rows {
		keys[i] = row.key
	}

	return Window{From: bucketStart(slices.Min(keys)), To: bucketEnd(slices.Max(keys))}
}

func bucketStart(k string) string {
	switch len(k) {
	case len("2006-01"):
		return k + "-01"
	case len("2006"):
		return k + "-01-01"
	}

	return k
}

func bucketEnd(k string) string {
	switch len(k) {
	case len("2006-01"):
		d, _ := time.Parse("2006-01", k)
		return d.AddDate(0, 1, -1).Format(time.DateOnly)
	case len("2006"):
		return k + "-12-31"
	}

	return k
}

// unit names the kind of a value a chart draws; "" for a gap.
func (v Value) unit() string {
	switch {
	case v.Money != nil:
		return "money:" + v.Money.Currency
	case v.Count != nil:
		return "count"
	}

	return ""
}

// number is the integer a chart value holds: minor units of an amount or a count.
func (v Value) number() int64 {
	switch {
	case v.Money != nil:
		return v.Money.Amount
	case v.Count != nil:
		return *v.Count
	}

	return 0
}
