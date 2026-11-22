package view

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"unicode/utf8"
)

// Limits of a chart spec (answer views design, V28).
const (
	maxChartTitle  = 60
	maxSeriesLabel = 40
	maxSeries      = 6
	maxFilters     = 4
	maxXLimit      = 24
	maxSplitLimit  = 8
)

// The closed sets a chart spec chooses from (V28).
var (
	chartOps     = []string{"eq", "ne", "gt", "gte", "lt", "lte", "contains"}
	chartBuckets = []string{"", "day", "month", "year"}
	chartSorts   = []string{"", "x", "desc", "asc"}
	chartAggs    = []string{"sum", "count", "avg", "min", "max", "first", "last"}
	chartSigns   = []string{"", "as_is", "negate", "abs"}
	chartKinds   = []string{"bar", "line", "area", "pie"}
	chartAxes    = []string{"", "start", "end"}
	chartCurves  = []string{"", "linear", "monotone", "step"}
	chartTones   = []string{"", "success", "danger", "warning", "info", "neutral"}
	chartOrients = []string{"", "vertical", "horizontal"}
	chartStacks  = []string{"", "normal", "percent"}
)

// ErrNoRecords: no item of the read passes the filters, so the chart has nothing to draw.
var ErrNoRecords = errors.New("no record of the read passes the filters; there is nothing to draw")

// ChartSpec is what the model asks a chart of a read to draw (V28). It names fields of the
// read's output and never a figure.
type ChartSpec struct {
	Title       string        `json:"title"`
	Items       string        `json:"items"`
	Where       []ChartFilter `json:"where"`
	X           ChartX        `json:"x"`
	Split       *ChartSplit   `json:"split"`
	Series      []ChartSeries `json:"series"`
	Orientation string        `json:"orientation"`
	StackMode   string        `json:"stack_mode"`
	Average     []int         `json:"average"`
}

// ChartFilter keeps the items whose field compares to value by op.
type ChartFilter struct {
	Field string          `json:"field"`
	Op    string          `json:"op"`
	Value json.RawMessage `json:"value"`
}

// ChartX is the field that places each row, and how dates are grouped and rows ordered.
type ChartX struct {
	Field  string `json:"field"`
	Bucket string `json:"bucket"`
	From   string `json:"from"`
	To     string `json:"to"`
	Label  string `json:"label"`
	Sort   string `json:"sort"`
	Limit  int    `json:"limit"`
}

// ChartSplit turns the only series into one series per value of field (V33).
type ChartSplit struct {
	Field string `json:"field"`
	Limit int    `json:"limit"`
}

// ChartSeries is one aggregated field and how it is drawn.
type ChartSeries struct {
	Field string `json:"field"`
	Agg   string `json:"agg"`
	Sign  string `json:"sign"`
	Kind  string `json:"kind"`
	Label string `json:"label"`
	Axis  string `json:"axis"`
	Stack bool   `json:"stack"`
	Curve string `json:"curve"`
	Tone  string `json:"tone"`
}

// Chart builds the view of a chart over the outputs of one read, one output per page
// (V27 to V35).
func Chart(outputs []json.RawMessage, spec ChartSpec) (Payload, error) {
	if err := spec.validate(); err != nil {
		return Payload{}, err
	}

	items, err := chartItems(outputs, spec.Items)
	if err != nil {
		return Payload{}, err
	}

	kept := make([]map[string]any, 0, len(items))
	for _, it := range items {
		ok, err := keep(it, spec.Where)
		if err != nil {
			return Payload{}, err
		}

		if ok {
			kept = append(kept, it)
		}
	}

	if len(kept) == 0 {
		return Payload{}, ErrNoRecords
	}

	g, err := groupItems(kept, spec)
	if err != nil {
		return Payload{}, err
	}

	return drawChart(g, spec, len(kept))
}

func (s ChartSpec) validate() error {
	n := utf8.RuneCountInString(s.Title)
	if n == 0 || n > maxChartTitle {
		return fmt.Errorf("title: 1 to %d characters", maxChartTitle)
	}

	if s.Items == "" || s.X.Field == "" {
		return errors.New("items and x.field name fields of the output")
	}

	if len(s.Where) > maxFilters {
		return fmt.Errorf("where: at most %d filters", maxFilters)
	}

	for _, f := range s.Where {
		if f.Field == "" || !slices.Contains(chartOps, f.Op) {
			return fmt.Errorf("where: field and op, one of %v", chartOps)
		}
	}

	if err := s.X.validate(); err != nil {
		return err
	}

	if err := s.validateSeries(); err != nil {
		return err
	}

	if !slices.Contains(chartOrients, s.Orientation) || !slices.Contains(chartStacks, s.StackMode) {
		return errors.New("orientation: vertical or horizontal; stack_mode: normal or percent")
	}

	return s.validateSplit()
}

func (x ChartX) validate() error {
	if !slices.Contains(chartBuckets, x.Bucket) || !slices.Contains(chartSorts, x.Sort) {
		return errors.New("x.bucket: day, month or year; x.sort: x, desc or asc")
	}

	if x.Limit < 0 || x.Limit > maxXLimit {
		return fmt.Errorf("x.limit: 1 to %d", maxXLimit)
	}

	for _, d := range []string{x.From, x.To} {
		if d != "" && textCell(d).kind != cellDate {
			return errors.New("x.from and x.to are dates YYYY-MM-DD")
		}
	}

	if utf8.RuneCountInString(x.Label) > maxSeriesLabel {
		return fmt.Errorf("x.label: at most %d characters", maxSeriesLabel)
	}

	return nil
}

func (s ChartSpec) validateSeries() error {
	if len(s.Series) == 0 || len(s.Series) > maxSeries {
		return fmt.Errorf("series: 1 to %d", maxSeries)
	}

	for i, se := range s.Series {
		n := utf8.RuneCountInString(se.Label)
		switch {
		case n == 0 || n > maxSeriesLabel:
			return fmt.Errorf("series[%d].label: 1 to %d characters", i, maxSeriesLabel)
		case !slices.Contains(chartAggs, se.Agg) || !slices.Contains(chartKinds, se.Kind):
			return fmt.Errorf("series[%d]: agg one of %v, kind one of %v", i, chartAggs, chartKinds)
		case se.Agg != "count" && se.Field == "":
			return fmt.Errorf("series[%d].field: required by agg %s", i, se.Agg)
		case !slices.Contains(chartSigns, se.Sign) || !slices.Contains(chartAxes, se.Axis) ||
			!slices.Contains(chartCurves, se.Curve) || !slices.Contains(chartTones, se.Tone):
			return fmt.Errorf("series[%d]: sign, axis, curve or tone outside its set", i)
		}
	}

	for _, a := range s.Average {
		if a < 0 || a >= len(s.Series) {
			return fmt.Errorf("average: %d is not a series index", a)
		}
	}

	return nil
}

func (s ChartSpec) validateSplit() error {
	if s.Split == nil {
		return nil
	}

	if s.Split.Field == "" || s.Split.Limit < 0 || s.Split.Limit > maxSplitLimit {
		return fmt.Errorf("split: a field and a limit of 2 to %d", maxSplitLimit)
	}

	if len(s.Series) != 1 || s.Series[0].Kind == "pie" {
		return errors.New("split: takes exactly one series, not a pie")
	}

	return nil
}

// sums reports whether every series sums or counts, so missing rows read as zero.
func (s ChartSpec) sums() bool {
	for _, se := range s.Series {
		if se.Agg != "sum" && se.Agg != "count" {
			return false
		}
	}

	return true
}
