package view_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

// V38, X2: each derivation over the monthly sums 100.00, 50.00, 0 and 25.00 of a USD series.
func TestChartDerive(t *testing.T) {
	cases := []struct {
		derive string
		want   string
	}{
		{"cumulative", "2026-01 10000,2026-02 15000,2026-03 15000,2026-04 17500"},
		// 10000, 5000, 0 and 2500 over 17500: 57.142%, 28.571%, 0 and 14.285%.
		{"share", "2026-01 bp5714,2026-02 bp2857,2026-03 bp0,2026-04 bp1429"},
		{"change", "2026-01 -,2026-02 -5000,2026-03 -5000,2026-04 2500"},
		// -50%, -100%, and no rate over a month of zero.
		{"change_percent", "2026-01 -,2026-02 rate-5000,2026-03 rate-10000,2026-04 -"},
	}

	for _, c := range cases {
		t.Run(c.derive, func(t *testing.T) {
			p, err := view.Chart(outputs(deriveOutput), deriveSpec(c.derive))
			if err != nil {
				t.Fatal(err)
			}

			if got := strings.Join(derivedText(p.Rows), ","); got != c.want {
				t.Fatalf("rows = %s, want %s", got, c.want)
			}

			// The verdict reads the sums before the derivation.
			v := p.Verdict
			if v.Params["total"].Money.Amount != 17500 || v.Params["top"].Money.Amount != 10000 ||
				v.Params["total"].Money.Currency != "USD" {
				t.Fatalf("verdict = %+v", v)
			}
		})
	}
}

// V37: the model reads a share as a percent and a derived amount as a decimal.
func TestChartReadingOfDerived(t *testing.T) {
	cases := []struct {
		derive string
		want   string
	}{
		{"share", `["2026-01","57.14%"]`},
		{"change_percent", `["2026-02","-50.00%"]`},
		{"change", `["2026-01",null],["2026-02",{"amount":"-50.00","currency":"USD"}]`},
	}

	for _, c := range cases {
		t.Run(c.derive, func(t *testing.T) {
			p, err := view.Chart(outputs(deriveOutput), deriveSpec(c.derive))
			if err != nil {
				t.Fatal(err)
			}

			got, err := json.Marshal(p.Reading())
			if err != nil {
				t.Fatal(err)
			}

			if !strings.Contains(string(got), c.want) {
				t.Fatalf("reading = %s, want %s", got, c.want)
			}
		})
	}
}

// V38: the rules a derived series follows.
func TestChartDeriveRefuses(t *testing.T) {
	negative := `{"days":[{"date":"2026-01-10","inflow":{"amount":"-1.00","currency":"USD"}},
		{"date":"2026-02-10","inflow":{"amount":"3.00","currency":"USD"}}]}`
	zero := `{"days":[{"date":"2026-01-10","inflow":{"amount":"0.00","currency":"USD"}}]}`
	names := `{"days":[{"date":"Rent","inflow":{"amount":"1.00","currency":"USD"}}]}`

	cases := []struct {
		name   string
		output string
		edit   func(*view.ChartSpec)
		want   string
	}{
		{
			"unknown",
			deriveOutput,
			func(s *view.ChartSpec) { s.Series[0].Derive = "median" },
			"derive",
		},
		{"cumulative of an average", deriveOutput, func(s *view.ChartSpec) {
			s.Series[0].Agg, s.Series[0].Derive = "avg", "cumulative"
		}, "sums or counts"},
		{"share of an average", deriveOutput, func(s *view.ChartSpec) {
			s.Series[0].Agg, s.Series[0].Derive = "avg", "share"
		}, "sums or counts"},
		{"average of a derived series", deriveOutput, func(s *view.ChartSpec) {
			s.Series[0].Derive, s.Average = "change", []int{0}
		}, "average"},
		{
			"share below zero",
			negative,
			func(s *view.ChartSpec) { s.Series[0].Derive = "share" },
			"below zero",
		},
		{
			"share of nothing",
			zero,
			func(s *view.ChartSpec) { s.Series[0].Derive = "share" },
			"total of zero",
		},
		{"change over names", names, func(s *view.ChartSpec) {
			s.X.Bucket, s.Series[0].Derive = "", "change"
		}, "date x"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			spec := deriveSpec("")
			c.edit(&spec)

			_, err := view.Chart(outputs(c.output), spec)
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Fatalf("err = %v, want %q", err, c.want)
			}
		})
	}
}

// V38: a split derives each of its columns.
func TestChartDeriveSplit(t *testing.T) {
	out := `{"days":[
		{"date":"2026-01-10","kind":"a","inflow":{"amount":"1.00","currency":"USD"}},
		{"date":"2026-01-11","kind":"b","inflow":{"amount":"4.00","currency":"USD"}},
		{"date":"2026-02-10","kind":"a","inflow":{"amount":"2.00","currency":"USD"}}]}`
	spec := deriveSpec("cumulative")
	spec.Split = &view.ChartSplit{Field: "kind"}

	p, err := view.Chart(outputs(out), spec)
	if err != nil {
		t.Fatal(err)
	}

	// Columns ranked by total: b (4.00), then a (3.00).
	want := "2026-01 400 100,2026-02 400 300"
	if got := strings.Join(derivedText(p.Rows), ","); got != want {
		t.Fatalf("rows = %s, want %s", got, want)
	}
}

const deriveOutput = `{"days":[
	{"date":"2026-01-10","inflow":{"amount":"100.00","currency":"USD"}},
	{"date":"2026-02-05","inflow":{"amount":"50.00","currency":"USD"}},
	{"date":"2026-04-01","inflow":{"amount":"25.00","currency":"USD"}}]}`

func deriveSpec(derive string) view.ChartSpec {
	return view.ChartSpec{
		Title: "Inflow",
		Items: "days",
		X:     view.ChartX{Field: "date", Bucket: "month"},
		Series: []view.ChartSeries{
			{Field: "inflow", Agg: "sum", Kind: "line", Label: "Inflow", Derive: derive},
		},
	}
}

// derivedText writes each row as rowsText does, with a share as bpN and a rate as rateN.
func derivedText(t view.Table) []string {
	rows := rowsText(t)
	for i, r := range t.Rows {
		parts := strings.Split(rows[i], " ")
		for j, v := range r[1:] {
			switch {
			case v.BP != nil:
				parts[j+1] = "bp" + itoa(*v.BP)
			case v.Rate != nil:
				parts[j+1] = "rate" + itoa(*v.Rate)
			}
		}

		rows[i] = strings.Join(parts, " ")
	}

	return rows
}
