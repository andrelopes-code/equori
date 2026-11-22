package view_test

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

// V31, V34, V35: inflow by month of an account history, zero months filled, the mean marked.
func TestChartMonthlyInflow(t *testing.T) {
	out := `{"account_name":"Algum dinheiro","days":[
		{"date":"2026-01-10","inflow":{"amount":"100.00","currency":"BRL"}},
		{"date":"2026-03-05","inflow":{"amount":"50.00","currency":"BRL"}},
		{"date":"2026-03-20","inflow":{"amount":"25.50","currency":"BRL"}}]}`
	spec := view.ChartSpec{
		Title: "Entradas em 2026",
		Items: "days",
		X:     view.ChartX{Field: "date", Bucket: "month", From: "2026-01-01", To: "2026-04-30"},
		Series: []view.ChartSeries{
			{Field: "inflow", Agg: "sum", Kind: "bar", Label: "Entradas", Tone: "success"},
		},
		Average: []int{0},
	}

	p, err := view.Chart(outputs(out), spec)
	if err != nil {
		t.Fatal(err)
	}

	// 100.00 + 0 + 75.50 + 0 over 4 months: 4387.5 rounds half to even to 4388.
	want := []string{"2026-01 10000", "2026-02 0", "2026-03 7550", "2026-04 0"}
	if got := rowsText(p.Rows); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("rows = %v, want %v", got, want)
	}

	if p.Window.From != "2026-01-01" || p.Window.To != "2026-04-30" {
		t.Fatalf("window = %+v", p.Window)
	}

	if len(p.Plot.Marks) != 1 || p.Plot.Marks[0].Value.Money.Amount != 4388 {
		t.Fatalf("marks = %+v", p.Plot.Marks)
	}

	if p.Plot.Series[0] != (view.PlotSeries{Column: 1, Kind: "bar", Tone: "success"}) {
		t.Fatalf("series = %+v", p.Plot.Series)
	}

	v := p.Verdict
	if v.Key != "assistantView.chart.verdict_total" || v.Params["total"].Money.Amount != 17550 ||
		v.Params["top"].Money.Amount != 10000 || v.Params["label"].Month != "2026-01" {
		t.Fatalf("verdict = %+v", v)
	}

	if *p.Prov.Params["count"].Count != 3 {
		t.Fatalf("prov = %+v", p.Prov)
	}
}

// V31: a text x sorts by value and folds the rows past the limit into one rest row.
func TestChartFoldsTheRest(t *testing.T) {
	out := `{"items":[
		{"name":"A","total":{"amount":"1.00","currency":"BRL"}},
		{"name":"B","total":{"amount":"4.00","currency":"BRL"}},
		{"name":"C","total":{"amount":"3.00","currency":"BRL"}},
		{"name":"D","total":{"amount":"2.00","currency":"BRL"}}]}`
	spec := view.ChartSpec{
		Title:  "Categorias",
		Items:  "items",
		X:      view.ChartX{Field: "name", Limit: 3},
		Series: []view.ChartSeries{{Field: "total", Agg: "sum", Kind: "pie", Label: "Total"}},
	}

	p, err := view.Chart(outputs(out), spec)
	if err != nil {
		t.Fatal(err)
	}

	want := "B 400,C 300,assistantView.chart.rest 300"
	if got := strings.Join(rowsText(p.Rows), ","); got != want {
		t.Fatalf("rows = %s, want %s", got, want)
	}

	if *p.Rows.Rows[2][0].Count != 2 {
		t.Fatalf("rest count = %+v", p.Rows.Rows[2][0])
	}
}

// V28, V30: where compares an amount as an exact decimal; sign turns outflows positive.
func TestChartWhereAndSign(t *testing.T) {
	out := `{"rows":[
		{"day":"2026-05-01","amount":{"amount":"-10.00","currency":"BRL"}},
		{"day":"2026-05-01","amount":{"amount":"-0.01","currency":"BRL"}},
		{"day":"2026-05-02","amount":{"amount":"20.00","currency":"BRL"}}]}`
	spec := view.ChartSpec{
		Title: "Saídas",
		Items: "rows",
		Where: []view.ChartFilter{{Field: "amount", Op: "lt", Value: json.RawMessage(`-0.01`)}},
		X:     view.ChartX{Field: "day"},
		Series: []view.ChartSeries{
			{Field: "amount", Agg: "sum", Sign: "negate", Kind: "line", Label: "Saídas"},
		},
	}

	p, err := view.Chart(outputs(out), spec)
	if err != nil {
		t.Fatal(err)
	}

	if got := strings.Join(rowsText(p.Rows), ","); got != "2026-05-01 1000" {
		t.Fatalf("rows = %s", got)
	}
}

// V33: split draws one column per category, the largest first, the rest as Outros.
func TestChartSplit(t *testing.T) {
	out := `{"t":[
		{"m":"2026-01","c":"Food","v":{"amount":"5.00","currency":"BRL"}},
		{"m":"2026-01","c":"Home","v":{"amount":"9.00","currency":"BRL"}},
		{"m":"2026-02","c":"Fun","v":{"amount":"1.00","currency":"BRL"}},
		{"m":"2026-02","c":"Food","v":{"amount":"2.00","currency":"BRL"}}]}`
	spec := view.ChartSpec{
		Title: "Por categoria",
		Items: "t",
		X:     view.ChartX{Field: "m"},
		Split: &view.ChartSplit{Field: "c", Limit: 2},
		Series: []view.ChartSeries{
			{Field: "v", Agg: "sum", Kind: "bar", Label: "Gasto", Stack: true},
		},
	}

	p, err := view.Chart(outputs(out), spec)
	if err != nil {
		t.Fatal(err)
	}

	// Limit 2 draws two columns: Home (9.00) leads; Food (7.00) and Fun (1.00) fold into Outros.
	head := strings.Join(p.Rows.Head, ",")
	if head != "assistantView.chart.period,Home,assistantView.chart.others" {
		t.Fatalf("head = %s", head)
	}

	want := "2026-01 900 500,2026-02 0 300"
	if got := strings.Join(rowsText(p.Rows), ","); got != want {
		t.Fatalf("rows = %s, want %s", got, want)
	}

	if p.Verdict.Params["total"].Money.Amount != 1700 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// V30, V31: a series that does not sum leaves the rows without items as they are.
func TestChartLastBalance(t *testing.T) {
	out := `{"points":[
		{"date":"2026-01-05","balance":{"amount":"10.00","currency":"USD"}},
		{"date":"2026-01-31","balance":{"amount":"12.00","currency":"USD"}},
		{"date":"2026-03-31","balance":{"amount":"7.00","currency":"USD"}}]}`
	spec := view.ChartSpec{
		Title: "Saldo",
		Items: "points",
		X:     view.ChartX{Field: "date", Bucket: "month"},
		Series: []view.ChartSeries{
			{Field: "balance", Agg: "last", Kind: "line", Label: "Saldo", Curve: "step"},
		},
	}

	p, err := view.Chart(outputs(out), spec)
	if err != nil {
		t.Fatal(err)
	}

	if got := strings.Join(rowsText(p.Rows), ","); got != "2026-01 1200,2026-03 700" {
		t.Fatalf("rows = %s", got)
	}

	v := p.Verdict
	if v.Key != "assistantView.chart.verdict_range" || v.Params["low"].Money.Amount != 700 ||
		v.Params["high"].Money.Currency != "USD" {
		t.Fatalf("verdict = %+v", v)
	}
}

func TestChartRefuses(t *testing.T) {
	money := `{"items":[{"n":"A","v":{"amount":"1.00","currency":"BRL"},"k":2},` +
		`{"n":"B","v":{"amount":"-1.00","currency":"USD"},"k":3}]}`
	brl := `{"items":[{"n":"A","v":{"amount":"1.00","currency":"BRL"},"k":2},` +
		`{"n":"B","v":{"amount":"-1.00","currency":"BRL"},"k":3}]}`
	sum := func(kind, axis string) view.ChartSeries {
		return view.ChartSeries{Field: "v", Agg: "sum", Kind: kind, Label: "V", Axis: axis}
	}
	count := view.ChartSeries{Field: "k", Agg: "sum", Kind: "line", Label: "K"}

	cases := []struct {
		name   string
		out    string
		items  string
		series []view.ChartSeries
		want   string
	}{
		{"two currencies", money, "items", []view.ChartSeries{sum("bar", "")}, "BRL and USD"},
		{"pie below zero", brl, "items", []view.ChartSeries{sum("pie", "")}, "below zero"},
		{
			"two units on one axis",
			brl,
			"items",
			[]view.ChartSeries{sum("bar", ""), count},
			"one unit",
		},
		{"not an array", brl, "n", []view.ChartSeries{sum("bar", "")}, "not an array"},
		{"no label", brl, "items", []view.ChartSeries{{Agg: "sum", Kind: "bar"}}, "label"},
		{
			"more pages",
			`{"items":[],"next_cursor":"x"}`,
			"items",
			[]view.ChartSeries{sum("bar", "")},
			"next",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			spec := view.ChartSpec{
				Title:  "T",
				Items:  c.items,
				X:      view.ChartX{Field: "n"},
				Series: c.series,
			}

			_, err := view.Chart(outputs(c.out), spec)
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Fatalf("err = %v, want %q", err, c.want)
			}
		})
	}
}

// V34: an amount and a count read on two axes.
func TestChartTwoAxes(t *testing.T) {
	out := `{"items":[{"n":"A","v":{"amount":"1.00","currency":"BRL"},"k":2}]}`
	spec := view.ChartSpec{
		Title: "T",
		Items: "items",
		X:     view.ChartX{Field: "n"},
		Series: []view.ChartSeries{
			{Field: "v", Agg: "sum", Kind: "bar", Label: "V"},
			{Field: "k", Agg: "sum", Kind: "line", Label: "K", Axis: "end"},
		},
	}

	p, err := view.Chart(outputs(out), spec)
	if err != nil {
		t.Fatal(err)
	}

	if p.Plot.Series[1].Axis != "end" || *p.Rows.Rows[0][2].Count != 2 {
		t.Fatalf("plot = %+v rows = %+v", p.Plot, p.Rows)
	}
}

func TestChartNoRecords(t *testing.T) {
	spec := view.ChartSpec{
		Title: "T",
		Items: "items",
		X:     view.ChartX{Field: "n"},
		Series: []view.ChartSeries{
			{Agg: "count", Kind: "bar", Label: "N"},
		},
	}

	if _, err := view.Chart(outputs(`{"items":[]}`), spec); !errors.Is(err, view.ErrNoRecords) {
		t.Fatalf("err = %v", err)
	}
}

func outputs(docs ...string) []json.RawMessage {
	out := make([]json.RawMessage, len(docs))
	for i, d := range docs {
		out[i] = json.RawMessage(d)
	}

	return out
}

// rowsText writes each row as its label and its numbers, so a case reads as one string.
func rowsText(t view.Table) []string {
	rows := make([]string, len(t.Rows))
	for i, r := range t.Rows {
		parts := []string{r[0].Text + r[0].Month + r[0].Date}
		for _, v := range r[1:] {
			switch {
			case v.Money != nil:
				parts = append(parts, itoa(v.Money.Amount))
			case v.Count != nil:
				parts = append(parts, itoa(*v.Count))
			default:
				parts = append(parts, "-")
			}
		}

		rows[i] = strings.Join(parts, " ")
	}

	return rows
}

func itoa(n int64) string { return strconv.FormatInt(n, 10) }

// V30, V32: gt keeps only values above the bound; avg rounds half to even in minor units.
func TestChartAvgAndStrictBound(t *testing.T) {
	out := `{"items":[
		{"n":"A","v":{"amount":"0.01","currency":"BRL"}},
		{"n":"A","v":{"amount":"0.02","currency":"BRL"}},
		{"n":"A","v":{"amount":"5.00","currency":"BRL"}},
		{"n":"B","v":{"amount":"0.03","currency":"BRL"}},
		{"n":"B","v":{"amount":"0.04","currency":"BRL"}}]}`
	spec := view.ChartSpec{
		Title:  "T",
		Items:  "items",
		Where:  []view.ChartFilter{{Field: "v", Op: "gt", Value: json.RawMessage(`"0.01"`)}},
		X:      view.ChartX{Field: "n", Sort: "x"},
		Series: []view.ChartSeries{{Field: "v", Agg: "avg", Kind: "bar", Label: "V"}},
	}

	p, err := view.Chart(outputs(out), spec)
	if err != nil {
		t.Fatal(err)
	}

	// A keeps 2 and 500: 251. B keeps 3 and 4: 3.5 rounds to the even 4, not down to 3.
	if got := strings.Join(rowsText(p.Rows), ","); got != "A 251,B 4" {
		t.Fatalf("rows = %s", got)
	}
}
