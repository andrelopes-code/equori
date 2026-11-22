package view

import (
	"cmp"
	"fmt"
	"slices"
)

// Limits of the rows of a chart (V31) and of the series a split draws (V33).
const (
	maxBuckets      = 400
	defaultXLimit   = 12
	pieLimit        = 8
	defaultSplitCut = 6
)

// Labels the client translates.
const (
	restKey   = "assistantView.chart.rest"
	othersKey = "assistantView.chart.others"
	noneKey   = "assistantView.chart.none"
)

// chartGroups is the rows of a chart before drawing: one group per row, one column per series.
type chartGroups struct {
	rows   []*group
	heads  []string
	units  []string
	series []int
	dated  bool
}

type group struct {
	key   string
	label Value
	accs  []acc
}

// acc aggregates the values of one column of one row; x orders first and last.
type acc struct {
	n, sum, min, max, first, last int64
	firstX, lastX                 string
}

// column is where one item's value lands: its column and the value.
type column struct {
	col int
	v   int64
}

// groupItems groups the kept items into rows and aggregates each series (V31 to V33).
func groupItems(items []map[string]any, spec ChartSpec) (*chartGroups, error) {
	g, place, err := newColumns(items, spec)
	if err != nil {
		return nil, err
	}

	byKey := map[string]*group{}

	for _, it := range items {
		key, label, raw, dated, err := xKey(it, spec.X)
		if err != nil {
			return nil, err
		}

		if len(byKey) > 0 && dated != g.dated {
			return nil, fmt.Errorf("x: %s mixes dates and texts", spec.X.Field)
		}

		g.dated = dated

		row, ok := byKey[key]
		if !ok {
			row = &group{key: key, label: label, accs: make([]acc, len(g.heads))}
			byKey[key] = row
		}

		cols, err := place(it)
		if err != nil {
			return nil, err
		}

		for _, c := range cols {
			row.accs[c.col].add(c.v, raw)
		}
	}

	if err := g.collect(byKey, spec); err != nil {
		return nil, err
	}

	return g, nil
}

// xKey returns the row of an item: its key, its label, the raw x that orders first and last,
// and whether x is a date.
func xKey(it map[string]any, x ChartX) (string, Value, string, bool, error) {
	c := field(it, x.Field)

	switch {
	case c.kind == cellText:
		return c.s, labelText(c.s), "", false, nil
	case c.kind == cellDate && (x.Bucket == "" || x.Bucket == "day"):
		return c.s, DateValue(c.s), c.s, true, nil
	case (c.kind == cellDate || c.kind == cellMonth) && x.Bucket == "year":
		return c.s[:4], TextValue(c.s[:4]), c.s, true, nil
	case c.kind == cellDate && x.Bucket == "month", c.kind == cellMonth && x.Bucket != "day":
		return c.s[:7], MonthValue(c.s[:7]), c.s, true, nil
	}

	return "", Value{}, "", false, fmt.Errorf(
		"x: %s must hold dates, months or texts (a month takes bucket month or year)",
		x.Field,
	)
}

// collect fills the missing buckets, orders the rows and folds the rest (V31).
func (g *chartGroups) collect(byKey map[string]*group, spec ChartSpec) error {
	if g.dated && spec.sums() {
		if err := g.fill(byKey, spec.X); err != nil {
			return err
		}
	}

	for _, row := range byKey {
		g.rows = append(g.rows, row)
	}

	g.order(spec)

	if !g.dated {
		g.fold(spec)
	}

	return nil
}

// fill adds a zero row for every bucket between the first and the last, widened to x.from and
// x.to.
func (g *chartGroups) fill(byKey map[string]*group, x ChartX) error {
	keys := make([]string, 0, len(byKey)+2)
	for k := range byKey {
		keys = append(keys, k)
	}

	size := len(keys[0])
	for _, d := range []string{x.From, x.To} {
		if d != "" {
			keys = append(keys, d[:size])
		}
	}

	first, last := slices.Min(keys), slices.Max(keys)
	for k, n := first, 0; k <= last; k, n = nextBucket(k), n+1 {
		if n >= maxBuckets {
			return fmt.Errorf("x: more than %d buckets; use a larger bucket", maxBuckets)
		}

		if _, ok := byKey[k]; !ok {
			byKey[k] = &group{key: k, label: bucketLabel(k), accs: make([]acc, len(g.heads))}
		}
	}

	return nil
}

func (g *chartGroups) order(spec ChartSpec) {
	by := spec.X.Sort
	if by == "" && !g.dated {
		by = "desc"
	}

	slices.SortStableFunc(g.rows, func(a, b *group) int {
		switch by {
		case "desc":
			return cmp.Or(
				cmp.Compare(g.total(b, spec), g.total(a, spec)),
				cmp.Compare(a.key, b.key),
			)
		case "asc":
			return cmp.Or(
				cmp.Compare(g.total(a, spec), g.total(b, spec)),
				cmp.Compare(a.key, b.key),
			)
		}

		return cmp.Compare(a.key, b.key)
	})
}

// total is the value of a row that orders it: the sum of its columns' results.
func (g *chartGroups) total(row *group, spec ChartSpec) int64 {
	var t int64
	for i, a := range row.accs {
		v, _ := a.result(spec.Series[g.series[i]].Agg, spec.sums())
		t += v
	}

	return t
}

// fold keeps the first rows of a text x and adds the others into one rest row.
func (g *chartGroups) fold(spec ChartSpec) {
	limit := defaultXLimit
	if spec.Series[0].Kind == "pie" {
		limit = pieLimit
	}

	limit = cmp.Or(spec.X.Limit, limit)
	if len(g.rows) <= limit {
		return
	}

	if !spec.sums() {
		g.rows = g.rows[:limit]
		return
	}

	rest := &group{key: "\xff", accs: make([]acc, len(g.heads))}
	for _, row := range g.rows[limit-1:] {
		for i, a := range row.accs {
			rest.accs[i].sum += a.sum
			rest.accs[i].n += a.n
		}
	}

	count := int64(len(g.rows) - limit + 1)
	rest.label = Value{Text: restKey, Count: &count}
	g.rows = append(g.rows[:limit-1], rest)
}
