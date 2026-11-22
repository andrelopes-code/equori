package view_test

import (
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

// V40: an items path through an array of arrays reads each inner object as one record, with
// the fields of the object that holds it.
func TestChartNestedItems(t *testing.T) {
	out := `{"transactions":[
		{"date":"2026-01-10","payee_name":"Market","postings":[
			{"account_name":"Checking","account_class":"asset","amount":{"amount":"-30.00","currency":"USD"}},
			{"account_name":"Food","account_class":"expense","amount":{"amount":"30.00","currency":"USD"}}]},
		{"date":"2026-02-03","payee_name":"Cinema","postings":[
			{"account_name":"Checking","account_class":"asset","amount":{"amount":"-12.50","currency":"USD"}},
			{"account_name":"Leisure","account_class":"expense","amount":{"amount":"12.50","currency":"USD"}}]},
		{"date":"2026-02-20","payee_name":"Market","postings":[
			{"account_name":"Checking","account_class":"asset","amount":{"amount":"-7.50","currency":"USD"}},
			{"account_name":"Food","account_class":"expense","amount":{"amount":"7.50","currency":"USD"}}]}]}`
	spec := view.ChartSpec{
		Title: "Spending by month",
		Items: "transactions.postings",
		Where: []view.ChartFilter{{Field: "account_class", Op: "eq", Value: []byte(`"expense"`)}},
		X:     view.ChartX{Field: "date", Bucket: "month"},
		Series: []view.ChartSeries{
			{Field: "amount", Agg: "sum", Kind: "bar", Label: "Spent"},
		},
	}

	p, err := view.Chart(outputs(out), spec)
	if err != nil {
		t.Fatal(err)
	}

	if got := strings.Join(rowsText(p.Rows), ","); got != "2026-01 3000,2026-02 2000" {
		t.Fatalf("rows = %s", got)
	}

	// A field of the transaction names the rows of its postings.
	spec.X = view.ChartX{Field: "payee_name"}

	p, err = view.Chart(outputs(out), spec)
	if err != nil {
		t.Fatal(err)
	}

	if got := strings.Join(rowsText(p.Rows), ","); got != "Market 3750,Cinema 1250" {
		t.Fatalf("rows = %s", got)
	}

	if *p.Prov.Params["count"].Count != 3 {
		t.Fatalf("prov = %+v", p.Prov)
	}
}

func TestChartNestedItemsRefuses(t *testing.T) {
	out := `{"transactions":[{"date":"2026-01-10","postings":[]}],"total":3}`

	for _, path := range []string{"transactions.date", "total", "transactions.missing"} {
		spec := view.ChartSpec{
			Title:  "x",
			Items:  path,
			X:      view.ChartX{Field: "date"},
			Series: []view.ChartSeries{{Agg: "count", Kind: "bar", Label: "n"}},
		}

		_, err := view.Chart(outputs(out), spec)
		if err == nil || !strings.Contains(err.Error(), "is not an array") {
			t.Fatalf("%s: err = %v", path, err)
		}
	}
}
