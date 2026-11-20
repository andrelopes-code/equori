package toolapi_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
	"github.com/andrelopes-code/equori/internal/reporting/toolapi"
)

var today = time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC)

// totals writes a get_category_totals output: name=amount pairs in BRL, all top level.
func totals(from, to, currency string, pairs ...string) json.RawMessage {
	var cats []string
	for i, p := range pairs {
		name, amount, _ := strings.Cut(p, "=")
		cats = append(cats, fmt.Sprintf(
			`{"account_id":"a%d","name":%q,"total":{"amount":%q,"currency":%q},"subtree_total":{"amount":%q,"currency":%q}}`,
			i,
			name,
			amount,
			currency,
			amount,
			currency,
		))
	}

	return json.RawMessage(fmt.Sprintf(`{"from":%q,"to":%q,"categories":[%s],"view_source":"r1"}`,
		from, to, strings.Join(cats, ",")))
}

func build(
	t *testing.T,
	form string,
	sel view.Select,
	outputs ...json.RawMessage,
) (view.Payload, error) {
	t.Helper()

	b, ok := toolapi.Views()[view.Key{Tool: "get_category_totals", Form: form}]
	if !ok {
		t.Fatalf("no builder for %s", form)
	}

	return b(outputs, sel, today)
}

type rankingData struct {
	Total view.Money `json:"total"`
	Items []struct {
		Name    string     `json:"name"`
		Amount  view.Money `json:"amount"`
		ShareBP int64      `json:"share_bp"`
		Rank    int        `json:"rank"`
	} `json:"items"`
	Rest *struct {
		Count   int        `json:"count"`
		Amount  view.Money `json:"amount"`
		ShareBP int64      `json:"share_bp"`
	} `json:"rest"`
}

func decode[T any](t *testing.T, p view.Payload) T {
	t.Helper()

	b, err := json.Marshal(p.Data)
	if err != nil {
		t.Fatal(err)
	}

	var out T
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatal(err)
	}

	return out
}

// October of the mock: 5 categories shown, 7 more fold into the rest; total 8191.05.
func TestViewRanking(t *testing.T) {
	out := totals("2026-10-01", "2026-10-31", "BRL",
		"Moradia=3200.00", "Mercado=1497.00", "Restaurantes=864.30", "Transporte=412.75",
		"Assinaturas=289.40", "Saúde=280.00", "Lazer=280.00", "Pets=280.00", "Casa=280.00",
		"Presentes=280.00", "Farmácia=280.00", "Doações=247.60")

	p, err := build(t, "ranking", view.Select{}, out)
	if err != nil {
		t.Fatal(err)
	}

	d := decode[rankingData](t, p)
	if d.Total.Amount != 819105 || len(d.Items) != 5 || d.Items[0].Name != "Moradia" ||
		d.Items[0].ShareBP != 3907 || d.Items[0].Rank != 1 || d.Items[1].Name != "Mercado" ||
		d.Items[1].Amount.Amount != 149700 {
		t.Fatalf("data = %+v", d)
	}

	if d.Rest == nil || d.Rest.Count != 7 || d.Rest.Amount.Amount != 192760 ||
		d.Rest.ShareBP != 2353 {
		t.Fatalf("rest = %+v", d.Rest)
	}

	if p.Verdict.Key != "assistantView.ranking.verdict" ||
		p.Verdict.Params["name"].Text != "Moradia" ||
		*p.Verdict.Params["share"].BP != 3907 ||
		p.Verdict.Params["total"].Money.Amount != 819105 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}

	if p.Window.From != "2026-10-01" || p.Window.To != "2026-10-31" || len(p.Rows.Rows) != 6 {
		t.Fatalf("window = %+v, rows = %d", p.Window, len(p.Rows.Rows))
	}
}

func TestViewRankingEdges(t *testing.T) {
	p, err := build(t, "ranking", view.Select{}, totals("2026-12-01", "2026-12-31", "BRL"))
	if err != nil || p.Verdict.Key != "assistantView.ranking.empty" {
		t.Fatalf("empty: %+v, %v", p.Verdict, err)
	}

	if d := decode[rankingData](t, p); d.Items == nil || len(d.Items) != 0 || d.Rest != nil {
		t.Fatalf("empty data = %+v", d)
	}

	zero, err := build(
		t,
		"ranking",
		view.Select{},
		totals("2026-12-01", "2026-12-31", "BRL", "Doações=0.00"),
	)
	if err != nil || zero.Verdict.Key != "assistantView.ranking.empty" {
		t.Fatalf("zero: %+v, %v", zero.Verdict, err)
	}

	limited, err := build(t, "ranking", view.Select{Limit: 2},
		totals("2026-10-01", "2026-10-31", "BRL", "A=3.00", "B=2.00", "C=1.00"))
	if d := decode[rankingData](t, limited); err != nil || len(d.Items) != 2 || d.Rest.Count != 1 {
		t.Fatalf("limit 2: %+v, %v", d, err)
	}

	_, err = build(
		t,
		"ranking",
		view.Select{},
		json.RawMessage(
			`{"from":"2026-10-01","to":"2026-10-31","categories":[],"next_cursor":"x"}`,
		),
	)
	if err == nil {
		t.Fatal("a paged read built a ranking")
	}
}

type compareData struct {
	Items []struct {
		Name   string     `json:"name"`
		Before view.Money `json:"before"`
		After  view.Money `json:"after"`
	} `json:"items"`
	Difference view.Money `json:"difference"`
}

// September × October of the mock: +363.25 over the 4 categories, Mercado +312.40.
func TestViewCompare(t *testing.T) {
	sep := totals(
		"2026-09-01",
		"2026-09-30",
		"BRL",
		"Mercado=1184.60",
		"Restaurantes=610.20",
		"Transporte=398.00",
		"Lazer=520.00",
	)
	oct := totals(
		"2026-10-01",
		"2026-10-31",
		"BRL",
		"Mercado=1497.00",
		"Restaurantes=864.30",
		"Transporte=412.75",
		"Lazer=302.00",
	)

	// The order of the handles does not decide which period comes first.
	p, err := build(t, "compare", view.Select{}, oct, sep)
	if err != nil {
		t.Fatal(err)
	}

	d := decode[compareData](t, p)
	if d.Difference.Amount != 36325 || len(d.Items) != 4 || d.Items[0].Name != "Mercado" ||
		d.Items[0].Before.Amount != 118460 || d.Items[0].After.Amount != 149700 || d.Items[3].Name != "Lazer" {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.compare.verdict_more" ||
		p.Verdict.Params["amount"].Money.Amount != 36325 ||
		p.Verdict.Params["name"].Text != "Mercado" ||
		p.Verdict.Params["name_amount"].Money.Amount != 31240 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}

	less, err := build(
		t,
		"compare",
		view.Select{},
		oct,
		totals("2026-09-01", "2026-09-30", "BRL", "Mercado=5000.00"),
	)
	if err != nil || less.Verdict.Key != "assistantView.compare.verdict_less" {
		t.Fatalf("less: %+v, %v", less.Verdict, err)
	}

	_, err = build(
		t,
		"compare",
		view.Select{},
		oct,
		totals("2026-09-01", "2026-09-30", "USD", "Mercado=10.00"),
	)
	if !errors.Is(err, view.ErrCurrencies) {
		t.Fatalf("currencies: %v", err)
	}
}

type changesData struct {
	Items []struct {
		Name  string     `json:"name"`
		Delta view.Money `json:"delta"`
	} `json:"items"`
	Difference view.Money `json:"difference"`
}

// September to October of the mock: the categories by their change, largest rise first, falls last.
func TestViewChanges(t *testing.T) {
	sep := totals(
		"2026-09-01",
		"2026-09-30",
		"BRL",
		"Mercado=1184.60",
		"Restaurantes=610.20",
		"Viagens=0.00",
		"Transporte=398.00",
		"Saúde=296.30",
		"Lazer=520.00",
	)
	oct := totals(
		"2026-10-01",
		"2026-10-31",
		"BRL",
		"Mercado=1497.00",
		"Restaurantes=864.30",
		"Viagens=188.00",
		"Transporte=412.75",
		"Saúde=200.00",
		"Lazer=302.00",
	)

	p, err := build(t, "changes", view.Select{}, sep, oct)
	if err != nil {
		t.Fatal(err)
	}

	d := decode[changesData](t, p)
	names := make([]string, len(d.Items))
	for i, it := range d.Items {
		names[i] = it.Name
	}

	if strings.Join(names, ",") != "Mercado,Restaurantes,Viagens,Transporte,Saúde,Lazer" ||
		d.Items[0].Delta.Amount != 31240 || d.Items[4].Delta.Amount != -9630 || d.Difference.Amount != 45495 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.changes.verdict_more" ||
		p.Verdict.Params["amount"].Money.Amount != 45495 ||
		p.Verdict.Params["top"].Money.Amount != 56650 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

type treemapData struct {
	Total view.Money `json:"total"`
	Cells []struct {
		Name    string  `json:"name"`
		ShareBP int64   `json:"share_bp"`
		X       float64 `json:"x"`
		Y       float64 `json:"y"`
		W       float64 `json:"w"`
		H       float64 `json:"h"`
		Rest    bool    `json:"rest"`
	} `json:"cells"`
}

// The year of the mock: 7 categories and the rest; the areas tile the box and keep each share.
func TestViewTreemap(t *testing.T) {
	out := totals("2026-01-01", "2026-11-30", "BRL",
		"Moradia=35200.00", "Educação=22040.00", "Mercado=16430.00", "Restaurantes=9120.00",
		"Saúde=6240.00", "Transporte=4870.00", "Assinaturas=3180.00",
		"Pets=2000.00", "Casa=1800.00", "Presentes=1500.00", "Doações=1740.00")

	p, err := build(t, "treemap", view.Select{}, out)
	if err != nil {
		t.Fatal(err)
	}

	d := decode[treemapData](t, p)
	if d.Total.Amount != 10412000 || len(d.Cells) != 8 || !d.Cells[7].Rest ||
		d.Cells[7].ShareBP != 676 {
		t.Fatalf("data = %+v", d)
	}

	var area float64
	for _, c := range d.Cells {
		area += c.W * c.H
		if c.X < 0 || c.Y < 0 || c.X+c.W > 100.0001 || c.Y+c.H > 100.0001 {
			t.Fatalf("cell outside the box: %+v", c)
		}
	}

	if area < 9999.9 || area > 10000.1 {
		t.Fatalf("cells cover %.3f of 10000", area)
	}

	if moradia := d.Cells[0]; moradia.W*moradia.H < 3380 || moradia.W*moradia.H > 3382 {
		t.Fatalf("Moradia covers %.2f, want its share 3380.7", moradia.W*moradia.H)
	}

	if p.Verdict.Key != "assistantView.treemap.verdict" || *p.Verdict.Params["share"].BP != 5498 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// indicators writes a get_financial_indicators output; each month is month=income/expense/liquid/savings_bp/committed_bp/liquidity_bp.
func indicators(months ...string) json.RawMessage {
	var out []string
	for _, m := range months {
		month, rest, _ := strings.Cut(m, "=")
		f := strings.Split(rest, "/")
		brl := func(a string) string { return fmt.Sprintf(`{"amount":%q,"currency":"BRL"}`, a) }
		out = append(out, fmt.Sprintf(
			`{"month":%q,"income":%s,"expense":%s,"committed":%s,"debt_service":%s,"liquid_balance":%s,"liabilities":%s,`+
				`"savings_rate":{"bp":%s},"trailing_savings_rate":{"bp":0},"liquidity":{"bp":%s},"committed_share":{"bp":%s},"debt_service_share":{"bp":0}}`,
			month,
			brl(f[0]),
			brl(f[1]),
			brl("0.00"),
			brl("0.00"),
			brl(f[2]),
			brl("0.00"),
			f[3],
			f[5],
			f[4],
		))
	}

	return json.RawMessage(`{"months":[` + strings.Join(out, ",") + `]}`)
}

func indicatorsBuild(t *testing.T, form string, out json.RawMessage) view.Payload {
	t.Helper()

	b := toolapi.Views()[view.Key{Tool: "get_financial_indicators", Form: form}]
	if b == nil {
		t.Fatalf("no builder for %s", form)
	}

	p, err := b([]json.RawMessage{out}, view.Select{}, today)
	if err != nil {
		t.Fatal(err)
	}

	return p
}

var year = indicators(
	"2025-12=12000.00/9850.00/3000.00/1792/5200/20000",
	"2026-01=12000.00/7120.00/4000.00/4067/5100/22000",
	"2026-02=12000.00/6980.00/5000.00/4183/5000/24000",
	"2026-03=12000.00/7450.00/6000.00/3792/5200/26000",
	"2026-04=12000.00/6890.00/7000.00/4258/4900/28000",
	"2026-05=12000.00/7210.00/8000.00/3992/5000/30000",
	"2026-06=12000.00/8420.00/9000.00/2983/4800/32000",
	"2026-07=12000.00/7050.00/10000.00/4125/4900/34000",
	"2026-08=12000.00/6640.00/11000.00/4467/4800/36000",
	"2026-09=12000.00/7320.00/12000.00/3900/4700/38000",
	"2026-10=12400.00/8191.05/16208.95/3394/4900/42000",
	"2026-11=6000.00/5115.00/17093.95/1475/4800/42000",
)

// The months of the mock: November is open on the 19th, so the series reads October as the last
// closed month, third largest, and averages the 11 closed months.
func TestViewSeries(t *testing.T) {
	p := indicatorsBuild(t, "series", year)

	var d struct {
		Months []struct {
			Month   string     `json:"month"`
			Amount  view.Money `json:"amount"`
			Partial bool       `json:"partial"`
		} `json:"months"`
		Average view.Money `json:"average"`
		Focus   string     `json:"focus"`
	}
	b, _ := json.Marshal(p.Data)
	_ = json.Unmarshal(b, &d)

	if len(d.Months) != 12 || !d.Months[11].Partial || d.Months[10].Partial ||
		d.Focus != "2026-10" ||
		d.Average.Amount != 755646 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.series.verdict" || *p.Verdict.Params["rank"].Count != 3 ||
		p.Verdict.Params["month"].Month != "2026-10" || p.Verdict.Params["average"].Money.Amount != 755646 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// October of the mock: liquid balance 12000.00 at the end of September, 16208.95 at the end of
// October; income 12400.00 and expense 8191.05 leave 2000.00 of other movements.
func TestViewWaterfall(t *testing.T) {
	p := indicatorsBuild(t, "waterfall", year)

	var d struct {
		Month string `json:"month"`
		Steps []struct {
			Kind   string     `json:"kind"`
			Amount view.Money `json:"amount"`
		} `json:"steps"`
	}
	b, _ := json.Marshal(p.Data)
	_ = json.Unmarshal(b, &d)

	want := []struct {
		kind   string
		amount int64
	}{{"start", 1200000}, {"income", 1240000}, {"expense", -819105}, {"other", 0 - 200000 + 200000 - 200000 + 200000}, {"end", 1620895}}
	want[3].amount = 1620895 - 1200000 - 1240000 + 819105

	if d.Month != "2026-10" || len(d.Steps) != 5 {
		t.Fatalf("data = %+v", d)
	}

	for i, w := range want {
		if d.Steps[i].Kind != w.kind || d.Steps[i].Amount.Amount != w.amount {
			t.Fatalf("step %d = %+v, want %s %d", i, d.Steps[i], w.kind, w.amount)
		}
	}

	if p.Verdict.Key != "assistantView.waterfall.verdict_saved" ||
		p.Verdict.Params["amount"].Money.Amount != 420895 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// The tiles of October: savings 33.94%, committed share 49%, liquidity 4.2 months.
func TestViewIndicators(t *testing.T) {
	p := indicatorsBuild(t, "indicators", year)

	var d struct {
		Month string `json:"month"`
		Tiles []struct {
			Kind   string  `json:"kind"`
			BP     int64   `json:"bp"`
			Series []int64 `json:"series"`
		} `json:"tiles"`
	}
	b, _ := json.Marshal(p.Data)
	_ = json.Unmarshal(b, &d)

	if d.Month != "2026-10" || len(d.Tiles) != 3 || d.Tiles[0].Kind != "savings" ||
		d.Tiles[0].BP != 3394 ||
		d.Tiles[1].BP != 4900 ||
		d.Tiles[2].Kind != "liquidity" ||
		d.Tiles[2].BP != 42000 ||
		len(d.Tiles[0].Series) != 11 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.indicators.verdict" ||
		*p.Verdict.Params["savings"].BP != 3394 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}
