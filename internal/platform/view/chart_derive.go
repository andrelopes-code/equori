package view

import (
	"errors"
	"fmt"
	"slices"
)

// Units of the values a derivation writes (answer views design, V38).
const (
	unitShare = "share"
	unitRate  = "rate"
)

func (se ChartSeries) validateDerive() error {
	if !slices.Contains(chartDerives, se.Derive) {
		return fmt.Errorf("derive: one of %v", chartDerives[1:])
	}

	sums := se.Agg == "sum" || se.Agg == "count"
	if (se.Derive == "cumulative" || se.Derive == "share") && !sums {
		return fmt.Errorf("derive %s: of a series that sums or counts", se.Derive)
	}

	return nil
}

// derive applies the derivation of each series to its columns, in the order of the rows (V38).
// base stays as aggregated: the verdict reads it.
func (g *chartGroups) derive(spec ChartSpec, base [][]Value) ([][]Value, error) {
	out := make([][]Value, len(base))
	for i := range base {
		out[i] = slices.Clone(base[i])
	}

	for col := range g.heads {
		d := spec.Series[g.series[col]].Derive
		if d == "" {
			continue
		}

		if d != "share" && !g.dated {
			return nil, fmt.Errorf("derive %s: takes a date x", d)
		}

		if err := g.deriveColumn(col, d, base, out); err != nil {
			return nil, err
		}
	}

	return out, nil
}

func (g *chartGroups) deriveColumn(col int, d string, base, out [][]Value) error {
	if d == "share" {
		return g.shareColumn(col, base, out)
	}

	var run int64

	var prev *int64

	for i, row := range base {
		v, gap := row[col].number(), row[col].unit() == ""
		run += v

		switch {
		case d == "cumulative":
			out[i][col] = g.typedValue(col, run)
		case gap || prev == nil:
			out[i][col] = Value{}
		case d == "change":
			out[i][col] = g.typedValue(col, v-*prev)
		case *prev == 0:
			out[i][col] = Value{}
		default:
			out[i][col] = RateValue(Share(v-*prev, abs(*prev)))
		}

		prev = &v
		if gap {
			prev = nil
		}
	}

	if d == "change_percent" {
		g.units[col] = unitRate
	}

	return nil
}

// shareColumn writes each value of col over the total of the column, in basis points.
func (g *chartGroups) shareColumn(col int, base, out [][]Value) error {
	var total int64
	for _, row := range base {
		v := row[col].number()
		if v < 0 {
			return errors.New("derive share: the series holds a value below zero")
		}

		total += v
	}

	if total == 0 {
		return errors.New("derive share: the series has a total of zero")
	}

	for i, row := range base {
		out[i][col] = BPValue(Share(row[col].number(), total))
	}

	g.units[col] = unitShare

	return nil
}
