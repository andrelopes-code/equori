package view_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

// V41: bucket weekday groups dates by their ISO day of the week, Monday first.
func TestChartWeekday(t *testing.T) {
	// 2026-01-05 and 2026-01-12 are Mondays, 2026-01-10 a Saturday, 2026-01-11 a Sunday.
	out := `{"days":[
		{"date":"2026-01-10","outflow":{"amount":"40.00","currency":"USD"}},
		{"date":"2026-01-05","outflow":{"amount":"10.00","currency":"USD"}},
		{"date":"2026-01-12","outflow":{"amount":"5.00","currency":"USD"}},
		{"date":"2026-01-11","outflow":{"amount":"1.00","currency":"USD"}}]}`
	spec := view.ChartSpec{
		Title: "Spending by weekday",
		Items: "days",
		X:     view.ChartX{Field: "date", Bucket: "weekday"},
		Series: []view.ChartSeries{
			{Field: "outflow", Agg: "sum", Kind: "bar", Label: "Spent"},
		},
	}

	p, err := view.Chart(outputs(out), spec)
	if err != nil {
		t.Fatal(err)
	}

	got := make([]string, len(p.Rows.Rows))
	for i, r := range p.Rows.Rows {
		got[i] = r[0].Text + " " + itoa(*r[0].Count) + " " + itoa(r[1].Money.Amount)
	}

	want := "assistantView.chart.weekday 1 1500," +
		"assistantView.chart.weekday 6 4000," +
		"assistantView.chart.weekday 7 100"
	if strings.Join(got, ",") != want {
		t.Fatalf("rows = %v", got)
	}

	reading, err := json.Marshal(p.Reading())
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(string(reading), `["Monday",{"amount":"15.00","currency":"USD"}]`) ||
		!strings.Contains(string(reading), `["Sunday",`) {
		t.Fatalf("reading = %s", reading)
	}

	// A month has no day of the week.
	months := `{"days":[{"date":"2026-01","outflow":{"amount":"1.00","currency":"USD"}}]}`
	if _, err := view.Chart(outputs(months), spec); err == nil {
		t.Fatal("a month took bucket weekday")
	}
}

// V38: the moving average of the last rows, over the monthly sums 100.00, 50.00, 0 and 25.00.
func TestChartMovingAverage(t *testing.T) {
	spec := deriveSpec("moving_average")
	spec.Series[0].Window = 2

	p, err := view.Chart(outputs(deriveOutput), spec)
	if err != nil {
		t.Fatal(err)
	}

	// 100.00; (100.00 + 50.00) / 2; (50.00 + 0) / 2; (0 + 25.00) / 2.
	want := "2026-01 10000,2026-02 7500,2026-03 2500,2026-04 1250"
	if got := strings.Join(rowsText(p.Rows), ","); got != want {
		t.Fatalf("rows = %s, want %s", got, want)
	}

	spec.Series[0].Window = 13
	if _, err := view.Chart(outputs(deriveOutput), spec); err == nil ||
		!strings.Contains(err.Error(), "window") {
		t.Fatalf("err = %v", err)
	}

	spec.Series[0].Window, spec.Series[0].Derive = 3, "cumulative"
	if _, err := view.Chart(outputs(deriveOutput), spec); err == nil ||
		!strings.Contains(err.Error(), "window") {
		t.Fatalf("err = %v", err)
	}
}
