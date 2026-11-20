package viewapi

import (
	"cmp"
	"encoding/json"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

// A purchase is out of pattern at 3 times its category's median or more; a category needs 3
// purchases for its median to mean anything.
const (
	outlierRatioBP = 30000
	outlierMinimum = 3
)

type outlierPoint struct {
	ID      string     `json:"id"`
	Name    string     `json:"name"`
	Amount  view.Money `json:"amount"`
	RatioBP int64      `json:"ratio_bp"`
}

type outlierRow struct {
	Category string         `json:"category"`
	Median   view.Money     `json:"median"`
	Points   []outlierPoint `json:"points"`
	Outlier  *outlierPoint  `json:"outlier,omitempty"`
}

type outliersData struct {
	Rows []outlierRow `json:"rows"`
}

// outliersView places each purchase of a category in multiples of the category's median.
func outliersView(outputs []json.RawMessage, _ view.Select, _ time.Time) (view.Payload, error) {
	txs, err := searchPages(outputs)
	if err != nil {
		return view.Payload{}, err
	}

	byCategory := map[string][]outlierPoint{}
	for _, t := range txs {
		it, err := txItemOf(t)
		if err != nil {
			return view.Payload{}, err
		}

		if it.Category != "" && it.Amount.Amount < 0 && !t.Voided {
			p := outlierPoint{
				ID:     it.ID,
				Name:   it.Name,
				Amount: view.Money{Amount: -it.Amount.Amount, Currency: it.Amount.Currency},
			}
			byCategory[it.Category] = append(byCategory[it.Category], p)
		}
	}

	data := outliersData{Rows: []outlierRow{}}
	for category, points := range byCategory {
		if len(points) >= outlierMinimum {
			data.Rows = append(data.Rows, outlierRowOf(category, points))
		}
	}

	slices.SortFunc(data.Rows, func(a, b outlierRow) int {
		return cmp.Or(cmp.Compare(ratioOf(b), ratioOf(a)), cmp.Compare(a.Category, b.Category))
	})

	return view.Payload{
		Title:   view.Text{Key: "assistantView.outliers.title"},
		Verdict: outliersVerdict(data.Rows),
		Open:    &view.Link{Screen: "/transactions"},
		Rows:    outliersRows(data.Rows),
		Data:    data,
	}, nil
}

// outlierRowOf computes the median and each purchase's ratio to it, and names the largest
// purchase when it passes the threshold.
func outlierRowOf(category string, points []outlierPoint) outlierRow {
	amounts := make([]int64, len(points))
	for i, p := range points {
		amounts[i] = p.Amount.Amount
	}

	slices.Sort(amounts)

	n := len(amounts)
	median := amounts[n/2]

	if n%2 == 0 {
		median = roundDiv(amounts[n/2-1]+amounts[n/2], 2)
	}

	row := outlierRow{
		Category: category,
		Median:   view.Money{Amount: median, Currency: points[0].Amount.Currency},
	}
	for i := range points {
		points[i].RatioBP = roundDiv(points[i].Amount.Amount*10000, median)
		if points[i].RatioBP >= outlierRatioBP &&
			(row.Outlier == nil || points[i].RatioBP > row.Outlier.RatioBP) {
			p := points[i]
			row.Outlier = &p
		}
	}

	row.Points = points

	return row
}

func ratioOf(r outlierRow) int64 {
	if r.Outlier == nil {
		return 0
	}

	return r.Outlier.RatioBP
}

func outliersVerdict(rows []outlierRow) view.Text {
	if len(rows) == 0 || rows[0].Outlier == nil {
		return view.Text{Key: "assistantView.outliers.none"}
	}

	o := rows[0].Outlier

	return view.Text{Key: "assistantView.outliers.verdict", Params: map[string]view.Value{
		"name":     view.TextValue(o.Name),
		"amount":   view.MoneyValue(o.Amount),
		"ratio":    view.TimesValue(o.RatioBP),
		"category": view.TextValue(rows[0].Category),
	}}
}

func outliersRows(rows []outlierRow) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.category",
			"assistantView.col.median",
			"assistantView.col.largest",
		},
		Rows: [][]view.Value{},
	}
	for _, r := range rows {
		largest := r.Points[0].Amount
		for _, p := range r.Points {
			if p.Amount.Amount > largest.Amount {
				largest = p.Amount
			}
		}

		t.Rows = append(
			t.Rows,
			[]view.Value{
				view.TextValue(r.Category),
				view.MoneyValue(r.Median),
				view.MoneyValue(largest),
			},
		)
	}

	return t
}
