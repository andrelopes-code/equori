package view

import (
	"cmp"
	"slices"
	"strconv"
	"time"
)

func (a *acc) add(v int64, x string) {
	a.n++
	a.sum += v

	if a.n == 1 || v < a.min {
		a.min = v
	}

	if a.n == 1 || v > a.max {
		a.max = v
	}

	if a.n == 1 || x < a.firstX {
		a.first, a.firstX = v, x
	}

	if a.n == 1 || x >= a.lastX {
		a.last, a.lastX = v, x
	}
}

// result is the aggregate of the column; false when the row holds no value of it.
func (a acc) result(agg string, sums bool) (int64, bool) {
	if a.n == 0 {
		return 0, sums
	}

	switch agg {
	case "sum":
		return a.sum, true
	case "count":
		return a.n, true
	case "avg":
		return roundDiv(a.sum, a.n), true
	case "min":
		return a.min, true
	case "max":
		return a.max, true
	case "first":
		return a.first, true
	}

	return a.last, true
}

func nextBucket(k string) string {
	switch len(k) {
	case len(time.DateOnly):
		d, _ := time.Parse(time.DateOnly, k)
		return d.AddDate(0, 0, 1).Format(time.DateOnly)
	case len("2006-01"):
		d, _ := time.Parse("2006-01", k)
		return d.AddDate(0, 1, 0).Format("2006-01")
	}

	y, _ := strconv.Atoi(k)

	return strconv.Itoa(y + 1)
}

func bucketLabel(k string) Value {
	switch len(k) {
	case len(time.DateOnly):
		return DateValue(k)
	case len("2006-01"):
		return MonthValue(k)
	}

	return TextValue(k)
}

func labelText(s string) Value {
	if s == "" {
		return TextValue(noneKey)
	}

	return TextValue(s)
}

func splitValue(it map[string]any, field string) string {
	c := typed(lookup(it, field))
	if c.kind == cellText || c.kind == cellDate || c.kind == cellMonth {
		return c.s
	}

	return ""
}

func sortedNames(totals map[string]int64) []string {
	names := make([]string, 0, len(totals))
	for n := range totals {
		names = append(names, n)
	}

	slices.SortFunc(names, func(a, b string) int {
		return cmp.Or(cmp.Compare(totals[b], totals[a]), cmp.Compare(a, b))
	})

	return names
}

func signed(v int64, sign string) int64 {
	switch sign {
	case "negate":
		return -v
	case "abs":
		return abs(v)
	}

	return v
}

func abs(v int64) int64 {
	if v < 0 {
		return -v
	}

	return v
}

func boolInt(b bool) int {
	if b {
		return 1
	}

	return 0
}

func unitName(unit string) string {
	if len(unit) > len("money:") && unit[:len("money:")] == "money:" {
		return unit[len("money:"):]
	}

	return unit
}

// roundDiv is a over b rounded half to even.
func roundDiv(a, b int64) int64 {
	q, r := a/b, a%b
	twice, den := abs(r)*2, abs(b)

	if twice > den || (twice == den && q%2 != 0) {
		if (a < 0) != (b < 0) {
			return q - 1
		}

		return q + 1
	}

	return q
}
