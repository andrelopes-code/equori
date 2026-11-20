package toolapi_test

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
	"github.com/andrelopes-code/equori/internal/portfolio/toolapi"
)

var today = time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC)

func brl(a string) string { return fmt.Sprintf(`{"amount":%q,"currency":"BRL"}`, a) }

func build(t *testing.T, form string, outs ...string) view.Payload {
	t.Helper()

	b := toolapi.Views()[view.Key{Tool: "get_portfolio", Form: form}]
	if b == nil {
		b = toolapi.Views()[view.Key{Tool: "get_tax_year", Form: form}]
	}

	if b == nil {
		t.Fatalf("no builder for %s", form)
	}

	raws := make([]json.RawMessage, len(outs))
	for i, o := range outs {
		raws[i] = json.RawMessage(o)
	}

	p, err := b(raws, view.Select{}, today)
	if err != nil {
		t.Fatal(err)
	}

	return p
}

func decode[T any](t *testing.T, p view.Payload) T {
	t.Helper()

	b, _ := json.Marshal(p.Data)

	var out T
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatal(err)
	}

	return out
}

// Net worth of the mock with its last 30 days: up R$ 2,918.00.
func TestViewFigure(t *testing.T) {
	worth := `{"assets":` + brl(
		"191192.18",
	) + `,"liabilities":` + brl(
		"3760.00",
	) + `,"net":` + brl(
		"187432.18",
	) + `}`
	days := `{"days":[{"date":"2026-10-20","assets":` + brl(
		"188274.18",
	) + `,"liabilities":` + brl(
		"3760.00",
	) + `,"net":` + brl(
		"184514.18",
	) +
		`},{"date":"2026-11-19","assets":` + brl(
		"191192.18",
	) + `,"liabilities":` + brl(
		"3760.00",
	) + `,"net":` + brl(
		"187432.18",
	) + `}]}`

	p := build(t, "figure", worth, days)
	d := decode[struct {
		Net         view.Money `json:"net"`
		Liabilities view.Money `json:"liabilities"`
		Change      view.Money `json:"change"`
		Series      []struct {
			Net view.Money `json:"net"`
		} `json:"series"`
	}](t, p)

	if d.Net.Amount != 18743218 || d.Liabilities.Amount != 376000 || d.Change.Amount != 291800 ||
		len(d.Series) != 2 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.figure.verdict_up" ||
		p.Verdict.Params["change"].Money.Amount != 291800 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}

	alone := build(t, "figure", worth)
	if alone.Verdict.Key != "assistantView.figure.verdict" {
		t.Fatalf("verdict without days = %+v", alone.Verdict)
	}
}

// Allocation by type: groups with their shares, largest first.
func TestViewAllocation(t *testing.T) {
	out := `{"total":` + brl(
		"176981.78",
	) + `,"groups":[{"key":"stock","value":` + brl(
		"54864.35",
	) + `,"share_bp":3100},` +
		`{"key":"fixed_income","value":` + brl(
		"92030.53",
	) + `,"share_bp":5200}]}`

	p := build(t, "allocation", out)
	d := decode[struct {
		Groups []struct {
			Key     string `json:"key"`
			ShareBP int64  `json:"share_bp"`
		} `json:"groups"`
	}](t, p)

	if len(d.Groups) != 2 || d.Groups[0].Key != "fixed_income" || d.Groups[0].ShareBP != 5200 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.allocation.verdict" ||
		p.Verdict.Params["name"].Text != "assistantView.group.fixed_income" {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// The next contribution of the mock: R$ 5,000 to fixed income, the only class below target.
func TestViewContribution(t *testing.T) {
	class := func(name string, target, share, after int, amount string) string {
		return fmt.Sprintf(
			`{"name":%q,"target_bp":%d,"value":%s,"share_bp":%d,"after_share_bp":%d,"amount":%s,"members":[]}`,
			name,
			target,
			brl("0.00"),
			share,
			after,
			brl(amount),
		)
	}
	out := `{"contribution":{"status":"complete","amount":` + brl(
		"5000.00",
	) + `,"total":` + brl(
		"176981.78",
	) + `,"classes":[` +
		class(
			"Renda fixa",
			6000,
			5200,
			5330,
			"5000.00",
		) + `,` + class(
		"Ações",
		2500,
		3100,
		3010,
		"0.00",
	) + `],"outside":[],"missing":[]}}`

	p := build(t, "contribution", out)
	d := decode[struct {
		Amount  view.Money `json:"amount"`
		Classes []struct {
			Name    string     `json:"name"`
			After   int64      `json:"after_bp"`
			Amount  view.Money `json:"amount"`
			Target  int64      `json:"target_bp"`
			ShareBP int64      `json:"share_bp"`
		} `json:"classes"`
	}](t, p)

	if d.Amount.Amount != 500000 || len(d.Classes) != 2 || d.Classes[0].After != 5330 ||
		d.Classes[0].Amount.Amount != 500000 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.contribution.verdict" ||
		p.Verdict.Params["name"].Text != "Renda fixa" {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// Holdings of the mock: PETR4 13.8% over its cost; BBAS3 the only one below.
func TestViewHoldings(t *testing.T) {
	pos := func(inst, cost, value string) string {
		return fmt.Sprintf(
			`{"account_id":"a","account_name":"XP","instrument":%q,"quantity":{"amount":"100","currency":%q},"cost_basis":%s,"market_value":%s}`,
			inst,
			inst,
			brl(cost),
			brl(value),
		)
	}
	out := `{"positions":[` + pos(
		"PETR4",
		"3420.00",
		"3892.00",
	) + `,` + pos(
		"BBAS3",
		"1480.69",
		"1418.50",
	) + `],"total":` + brl(
		"5310.50",
	) + `}`

	p := build(t, "holdings", out)
	d := decode[struct {
		Rows []struct {
			Instrument string `json:"instrument"`
			ResultBP   int64  `json:"result_bp"`
			WeightBP   int64  `json:"weight_bp"`
		} `json:"rows"`
		ResultBP int64 `json:"result_bp"`
	}](t, p)

	if len(d.Rows) != 2 || d.Rows[0].Instrument != "PETR4" || d.Rows[0].ResultBP != 1380 ||
		d.Rows[1].ResultBP != -420 ||
		d.Rows[0].WeightBP != 7329 ||
		d.ResultBP != 836 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.holdings.verdict_one_down" ||
		p.Verdict.Params["name"].Text != "BBAS3" {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// Return against the index of the mock: 14.29% against 14.10%.
func TestViewBenchmark(t *testing.T) {
	out := `{"period_bp":1429,"index":"cdi","benchmark":{"index":"cdi","from":"2025-12-01","until":"2026-11-18","return_bp":1429,"index_bp":1410,"excess_bp":19,"days":352}}`

	p := build(t, "benchmark", out)
	if p.Verdict.Key != "assistantView.benchmark.verdict_above" ||
		*p.Verdict.Params["excess"].BP != 19 ||
		p.Verdict.Params["index"].Text != "assistantView.index.cdi" {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// Tax of the mock: April and September owe R$ 838.80 together.
func TestViewTaxYear(t *testing.T) {
	month := func(m, result, tax, darf string) string {
		return fmt.Sprintf(
			`{"month":%q,"lines":[{"pool":"stocks","result":%s,"exempt":%s,"loss_used":%s,"loss_carried":%s,"base":%s,"tax":%s,"withheld":%s}],"darf":%s}`,
			m,
			brl(result),
			brl("0.00"),
			brl("0.00"),
			brl("0.00"),
			brl(result),
			brl(tax),
			brl("0.00"),
			brl(darf),
		)
	}
	out := `{"from":"2026-01-01","to":"2026-12-31","gain_tax":[` + month(
		"2026-03",
		"900.00",
		"0.00",
		"0.00",
	) + `,` +
		month(
			"2026-04",
			"2840.00",
			"426.00",
			"426.00",
		) + `,` + month(
		"2026-09",
		"2752.00",
		"412.80",
		"412.80",
	) + `]}`

	p := build(t, "tax_year", out)
	d := decode[struct {
		Months []struct {
			Month string     `json:"month"`
			Tax   view.Money `json:"tax"`
		} `json:"months"`
		Total view.Money `json:"total"`
	}](t, p)

	if len(d.Months) != 3 || d.Total.Amount != 83880 || d.Months[1].Tax.Amount != 42600 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.tax_year.verdict" || *p.Verdict.Params["count"].Count != 2 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}
