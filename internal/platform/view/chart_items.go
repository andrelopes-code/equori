package view

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"math/big"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// The most items one chart reads across its pages (V29).
const maxChartItems = 10000

var (
	monthPattern = regexp.MustCompile(`^[0-9]{4}-(0[1-9]|1[0-2])$`)
	datePattern  = regexp.MustCompile(`^[0-9]{4}-[0-9]{2}-[0-9]{2}$`)
)

// ErrMorePages: every page given has a next page, so the records are incomplete (V29).
var ErrMorePages = errors.New(
	"more records follow (next_cursor): read the next pages and pass every handle, " +
		"or narrow the read",
)

// cellKind is the type of one value of an item (V30).
type cellKind int

const (
	cellNone cellKind = iota
	cellMoney
	cellCount
	cellDate
	cellMonth
	cellText
)

// cell is one typed value of an item: num holds minor units of money or a count.
type cell struct {
	kind  cellKind
	num   int64
	cur   string
	scale int
	s     string
}

// chartItems returns the objects of the array at path in every output, in order.
func chartItems(outputs []json.RawMessage, path string) ([]map[string]any, error) {
	var (
		items []map[string]any
		ended bool
	)

	for _, out := range outputs {
		doc, err := decodeOutput(out)
		if err != nil {
			return nil, err
		}

		if c, _ := doc["next_cursor"].(string); c == "" {
			ended = true
		}

		list, err := expand(doc, strings.Split(path, "."), nil)
		if err != nil {
			return nil, fmt.Errorf("items: %q %w", path, err)
		}

		items = append(items, list...)
	}

	if !ended {
		return nil, ErrMorePages
	}

	if len(items) > maxChartItems {
		return nil, fmt.Errorf(
			"items: %d records; a chart reads at most %d",
			len(items),
			maxChartItems,
		)
	}

	return items, nil
}

// expand returns the objects of the array that steps reach under v. An array on the way gives
// one item per object of its inner array, and that item also holds the fields of the objects
// above it (V40); a field of the item wins over a field above.
func expand(v any, steps []string, above map[string]any) ([]map[string]any, error) {
	list, isList := v.([]any)
	obj, isObj := v.(map[string]any)

	if isObj && len(steps) > 0 {
		return expand(obj[steps[0]], steps[1:], above)
	}

	if !isList {
		return nil, errors.New("is not an array of the output")
	}

	var items []map[string]any

	for _, el := range list {
		obj, ok := el.(map[string]any)
		if !ok {
			return nil, errors.New("holds values that are not objects")
		}

		if len(steps) == 0 {
			items = append(items, under(above, obj))
			continue
		}

		inner, err := expand(obj[steps[0]], steps[1:], under(above, obj))
		if err != nil {
			return nil, err
		}

		items = append(items, inner...)
	}

	return items, nil
}

// under is obj with the fields of above that it does not hold.
func under(above, obj map[string]any) map[string]any {
	if len(above) == 0 {
		return obj
	}

	merged := maps.Clone(above)
	maps.Copy(merged, obj)

	return merged
}

func decodeOutput(out json.RawMessage) (map[string]any, error) {
	dec := json.NewDecoder(bytes.NewReader(out))
	dec.UseNumber()

	var doc map[string]any
	if err := dec.Decode(&doc); err != nil {
		return nil, fmt.Errorf("decode output: %w", err)
	}

	return doc, nil
}

// lookup follows a dot path through nested objects; nil when a step is missing.
func lookup(v any, path string) any {
	for _, step := range strings.Split(path, ".") {
		obj, ok := v.(map[string]any)
		if !ok {
			return nil
		}

		v = obj[step]
	}

	return v
}

// field reads the value at path in item as a cell. A path that ends at the amount of a money
// object reads the money object, so "inflow.amount" is "inflow" (V30).
func field(item map[string]any, path string) cell {
	if parent, ok := strings.CutSuffix(path, ".amount"); ok {
		if c := typed(lookup(item, parent)); c.kind == cellMoney {
			return c
		}
	}

	return typed(lookup(item, path))
}

// typed reads one raw value as a cell; cellNone for a value a chart cannot use.
func typed(raw any) cell {
	switch v := raw.(type) {
	case map[string]any:
		return moneyCell(v)
	case json.Number:
		n, err := strconv.ParseInt(v.String(), 10, 64)
		if err != nil {
			return cell{}
		}

		return cell{kind: cellCount, num: n}
	case string:
		return textCell(v)
	}

	return cell{}
}

func moneyCell(v map[string]any) cell {
	amount, ok := v["amount"].(string)
	if !ok {
		return cell{}
	}

	currency, ok := v["currency"].(string)
	if !ok {
		return cell{}
	}

	m, err := Amount(amount, currency)
	if err != nil {
		return cell{}
	}

	code, _ := money.ParseCurrency(currency)

	return cell{kind: cellMoney, num: m.Amount, cur: currency, scale: code.MinorUnits()}
}

func textCell(s string) cell {
	if datePattern.MatchString(s) {
		if _, err := time.Parse(time.DateOnly, s); err == nil {
			return cell{kind: cellDate, s: s}
		}
	}

	if monthPattern.MatchString(s) {
		return cell{kind: cellMonth, s: s}
	}

	return cell{kind: cellText, s: s}
}

// keep reports whether item passes every filter; a filter on a missing field drops it (V30).
func keep(item map[string]any, filters []ChartFilter) (bool, error) {
	for _, f := range filters {
		c := field(item, f.Field)
		if c.kind == cellNone {
			return false, nil
		}

		ok, err := f.match(c)
		if err != nil || !ok {
			return false, err
		}
	}

	return true, nil
}

// match compares c to the filter's value, a JSON text or number (V30).
func (f ChartFilter) match(c cell) (bool, error) {
	value := strings.TrimSpace(string(f.Value))

	var text string
	if json.Unmarshal(f.Value, &text) == nil {
		value = text
	}

	if c.kind != cellMoney && c.kind != cellCount {
		if f.Op == "contains" {
			return strings.Contains(strings.ToLower(c.s), strings.ToLower(value)), nil
		}

		return compare(f.Op, strings.Compare(c.s, value)), nil
	}

	want, ok := new(big.Rat).SetString(value)
	if !ok || f.Op == "contains" {
		return false, fmt.Errorf("where: %s holds numbers; compare it to a number", f.Field)
	}

	have := big.NewRat(c.num, 1)
	if c.kind == cellMoney {
		unit := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(c.scale)), nil)
		have.SetFrac(big.NewInt(c.num), unit)
	}

	return compare(f.Op, have.Cmp(want)), nil
}

// compare applies op to the sign of a comparison.
func compare(op string, sign int) bool {
	switch op {
	case "eq":
		return sign == 0
	case "ne":
		return sign != 0
	case "gt":
		return sign > 0
	case "gte":
		return sign >= 0
	case "lt":
		return sign < 0
	case "lte":
		return sign <= 0
	}

	return false
}
