package view

import (
	"cmp"
	"fmt"
)

// newColumns sets the columns of the chart and returns how an item reaches them.
func newColumns(
	items []map[string]any,
	spec ChartSpec,
) (*chartGroups, func(map[string]any) ([]column, error), error) {
	g := &chartGroups{}

	if spec.Split != nil {
		return splitColumns(g, items, spec)
	}

	for i, se := range spec.Series {
		g.heads = append(g.heads, se.Label)
		g.units = append(g.units, "")
		g.series = append(g.series, i)
	}

	place := func(it map[string]any) ([]column, error) {
		cols := make([]column, 0, len(spec.Series))
		for i, se := range spec.Series {
			v, err := g.value(it, se, i)
			if err != nil {
				return nil, err
			}

			cols = append(cols, column{col: i, v: v})
		}

		return cols, nil
	}

	return g, place, nil
}

// splitColumns draws one column per value of the split field, the largest first (V33).
func splitColumns(
	g *chartGroups,
	items []map[string]any,
	spec ChartSpec,
) (*chartGroups, func(map[string]any) ([]column, error), error) {
	se := spec.Series[0]
	totals := map[string]int64{}

	for _, it := range items {
		v, err := g.unitless(it, se)
		if err != nil {
			return nil, nil, err
		}

		totals[splitValue(it, spec.Split.Field)] += abs(v)
	}

	names := sortedNames(totals)
	limit := cmp.Or(spec.Split.Limit, defaultSplitCut)
	folded := len(names) > limit && spec.sums()

	if len(names) > limit {
		names = names[:limit-boolInt(folded)]
	}

	index := map[string]int{}
	for i, n := range names {
		index[n] = i
		g.heads = append(g.heads, cmp.Or(n, noneKey))
	}

	if folded {
		g.heads = append(g.heads, othersKey)
	}

	g.units = make([]string, len(g.heads))
	g.series = make([]int, len(g.heads))

	place := func(it map[string]any) ([]column, error) {
		col, ok := index[splitValue(it, spec.Split.Field)]
		if !ok && !folded {
			return nil, nil
		}

		if !ok {
			col = len(g.heads) - 1
		}

		v, err := g.value(it, se, col)

		return []column{{col: col, v: v}}, err
	}

	return g, place, nil
}

// value reads the value of se in it and checks that column col keeps one unit (V32, C2).
func (g *chartGroups) value(it map[string]any, se ChartSeries, col int) (int64, error) {
	if se.Agg == "count" {
		g.units[col] = "count"
		return 1, nil
	}

	c := field(it, se.Field)
	if c.kind != cellMoney && c.kind != cellCount {
		return 0, fmt.Errorf(
			"series: %s holds a value that is not an amount or an integer",
			se.Field,
		)
	}

	unit := "count"
	if c.kind == cellMoney {
		unit = "money:" + c.cur
	}

	if g.units[col] != "" && g.units[col] != unit {
		return 0, fmt.Errorf(
			"series: %s mixes %s and %s; filter one currency",
			se.Field, unitName(g.units[col]), unitName(unit),
		)
	}

	g.units[col] = unit

	return signed(c.num, se.Sign), nil
}

// unitless reads the value of se for ranking split values, before units are checked.
func (g *chartGroups) unitless(it map[string]any, se ChartSeries) (int64, error) {
	if se.Agg == "count" {
		return 1, nil
	}

	c := field(it, se.Field)
	if c.kind != cellMoney && c.kind != cellCount {
		return 0, fmt.Errorf(
			"series: %s holds a value that is not an amount or an integer",
			se.Field,
		)
	}

	return signed(c.num, se.Sign), nil
}
