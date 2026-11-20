package viewapi_test

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/ledger/viewapi"
	"github.com/andrelopes-code/equori/internal/platform/view"
)

var today = time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC)

// tx writes one transaction of search_transactions: an expense of amount on category, paid from account.
func tx(id, date, payee, account, category, amount string) string {
	brl := func(a string) string { return fmt.Sprintf(`{"amount":%q,"currency":"BRL"}`, a) }

	return fmt.Sprintf(`{"id":%q,"date":%q,"description":%q,"payee_name":%q,"postings":[`+
		`{"account_name":%q,"account_class":"asset","amount":%s},{"account_name":%q,"account_class":"expense","amount":%s}]}`,
		id, date, strings.ToUpper(payee), payee, account, brl("-"+amount), category, brl(amount))
}

func page(next string, txs ...string) json.RawMessage {
	return json.RawMessage(
		fmt.Sprintf(`{"transactions":[%s],"next_cursor":%q}`, strings.Join(txs, ","), next),
	)
}

func build(t *testing.T, tool, form string, outs ...json.RawMessage) view.Payload {
	t.Helper()

	b := viewapi.Views()[view.Key{Tool: tool, Form: form}]
	if b == nil {
		t.Fatalf("no builder for %s %s", tool, form)
	}

	p, err := b(outs, view.Select{}, today)
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

var ifood = []string{
	tx("t1", "2026-11-14", "iFood *Padaria", "Nubank", "Restaurantes", "28.50"),
	tx("t2", "2026-11-12", "iFood *Burger King", "Nubank", "Restaurantes", "45.90"),
	tx("t3", "2026-11-09", "iFood *Sushi Leblon", "Cartão Itaú", "Restaurantes", "112.00"),
	tx("t4", "2026-11-06", "iFood *Pizzaria Bráz", "Nubank", "Restaurantes", "38.40"),
	tx("t5", "2026-11-02", "iFood *Madero", "Cartão Itaú", "Restaurantes", "64.90"),
}

// The iFood orders of the mock, read in two pages: 5 orders, R$ 289.70, R$ 57.94 on average.
func TestViewTxs(t *testing.T) {
	p := build(t, "search_transactions", "txs", page("c", ifood[:3]...), page("", ifood[3:]...))

	d := decode[struct {
		Count   int        `json:"count"`
		Total   view.Money `json:"total"`
		Average view.Money `json:"average"`
		Items   []struct {
			Date     string     `json:"date"`
			Name     string     `json:"name"`
			Account  string     `json:"account"`
			Category string     `json:"category"`
			Amount   view.Money `json:"amount"`
		} `json:"items"`
	}](t, p)

	if d.Count != 5 || d.Total.Amount != -28970 || d.Average.Amount != -5794 || len(d.Items) != 5 ||
		d.Items[2].Name != "iFood *Sushi Leblon" || d.Items[2].Account != "Cartão Itaú" ||
		d.Items[2].Category != "Restaurantes" || d.Items[2].Amount.Amount != -11200 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.txs.verdict" || *p.Verdict.Params["count"].Count != 5 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

func TestViewTxsRefusesAnOpenPage(t *testing.T) {
	b := viewapi.Views()[view.Key{Tool: "search_transactions", Form: "txs"}]
	if _, err := b([]json.RawMessage{page("more", ifood...)}, view.Select{}, today); err == nil {
		t.Fatal("a view was built over a read with more pages")
	}
}

// One purchase of Eletrônicos at 10.7 times the category's median; the others within 3 times.
func TestViewOutliers(t *testing.T) {
	var txs []string
	for i, a := range []string{"18.90", "32.40", "45.10", "62.00", "88.30", "97.50", "112.40", "134.00", "156.20", "212.40", "248.00", "301.70"} {
		txs = append(
			txs,
			tx(fmt.Sprintf("m%d", i), "2026-11-10", "Mercado", "Nubank", "Mercado", a),
		)
	}

	for i, a := range []string{"89.90", "129.00", "199.00", "249.00", "349.00", "2399.00"} {
		txs = append(
			txs,
			tx(
				fmt.Sprintf("e%d", i),
				"2026-11-03",
				fmt.Sprintf("Loja %d", i),
				"Cartão Itaú",
				"Eletrônicos",
				a,
			),
		)
	}

	p := build(t, "search_transactions", "outliers", page("", txs...))
	d := decode[struct {
		Rows []struct {
			Category string     `json:"category"`
			Median   view.Money `json:"median"`
			Points   []struct {
				Amount  view.Money `json:"amount"`
				RatioBP int64      `json:"ratio_bp"`
			} `json:"points"`
			Outlier *struct {
				Name    string `json:"name"`
				RatioBP int64  `json:"ratio_bp"`
			} `json:"outlier"`
		} `json:"rows"`
	}](t, p)

	if len(d.Rows) != 2 || d.Rows[0].Category != "Eletrônicos" ||
		d.Rows[0].Median.Amount != 22400 ||
		d.Rows[0].Outlier == nil ||
		d.Rows[0].Outlier.RatioBP != 107098 ||
		d.Rows[1].Median.Amount != 10495 ||
		d.Rows[1].Outlier != nil ||
		len(d.Rows[1].Points) != 12 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.outliers.verdict" ||
		p.Verdict.Params["name"].Text != "Loja 5" ||
		*p.Verdict.Params["ratio"].Times != 107098 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// Spending per day of November up to the 19th: two purchases on the 8th, the peak.
func TestViewHeat(t *testing.T) {
	p := build(t, "search_transactions", "heat", page("",
		tx("a", "2026-11-08", "A", "Nubank", "Mercado", "400.00"),
		tx("b", "2026-11-08", "B", "Nubank", "Lazer", "212.40"),
		tx("c", "2026-11-01", "C", "Nubank", "Mercado", "110.20"),
		tx("d", "2026-11-15", "D", "Nubank", "Mercado", "502.17"),
	))

	d := decode[struct {
		Month string       `json:"month"`
		Days  []view.Money `json:"days"`
		Until int          `json:"until"`
		Peak  int          `json:"peak"`
	}](t, p)

	if d.Month != "2026-11" || len(d.Days) != 30 || d.Days[7].Amount != 61240 ||
		d.Days[0].Amount != 11020 ||
		d.Days[1].Amount != 0 ||
		d.Until != 19 ||
		d.Peak != 8 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.heat.verdict" ||
		p.Verdict.Params["day"].Date != "2026-11-08" ||
		p.Verdict.Params["amount"].Money.Amount != 61240 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// The Pão de Açúcar purchase of the mock: one correction, one attachment, postings that sum to zero.
func TestViewTransaction(t *testing.T) {
	out := `{"transaction":` + strings.TrimSuffix(
		tx("t9", "2026-11-18", "Pão de Açúcar", "Nubank", "Mercado", "212.40"),
		"}",
	) +
		`,"tags":["casa"],"version":2,"links":[],"referenced_by":[]},` +
		`"history":[{"version":1,"reason":"amount","replaced_at":"2026-11-19T09:58:00Z"}],` +
		`"attachments":[{"file_name":"nota.pdf","size":86016}],"disputes":[]}`

	p := build(t, "get_transaction", "transaction", json.RawMessage(out))
	d := decode[struct {
		Item struct {
			Amount view.Money `json:"amount"`
		} `json:"item"`
		Postings []struct {
			Amount view.Money `json:"amount"`
		} `json:"postings"`
		History     []struct{} `json:"history"`
		Attachments []struct{} `json:"attachments"`
	}](t, p)

	if d.Item.Amount.Amount != -21240 || len(d.Postings) != 2 ||
		d.Postings[0].Amount.Amount+d.Postings[1].Amount.Amount != 0 ||
		len(d.History) != 1 ||
		len(d.Attachments) != 1 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.transaction.verdict_changed_once" ||
		p.Open.Screen != "/transactions/t9" {
		t.Fatalf("verdict = %+v, open = %+v", p.Verdict, p.Open)
	}
}

// A redemption of the mock: net R$ 11,171.50 after R$ 248.50 of income tax.
func TestViewRedemption(t *testing.T) {
	p := build(t, "estimate_redemption", "redemption", json.RawMessage(
		`{"income_tax":{"amount":"248.50","currency":"BRL"},"iof":{"amount":"0.00","currency":"BRL"},"net":{"amount":"11171.50","currency":"BRL"}}`,
	))

	d := decode[struct {
		Gross view.Money `json:"gross"`
	}](t, p)

	if d.Gross.Amount != 1142000 || p.Verdict.Params["tax"].Money.Amount != 24850 {
		t.Fatalf("data = %+v, verdict = %+v", d, p.Verdict)
	}
}
