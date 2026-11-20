package toolapi_test

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/planning/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/view"
)

type budgetData struct {
	Day   int `json:"day"`
	Days  int `json:"days"`
	Items []struct {
		Name  string     `json:"name"`
		Spent view.Money `json:"spent"`
		Limit view.Money `json:"limit"`
		Over  view.Money `json:"over"`
	} `json:"items"`
}

func buildBudget(t *testing.T, out string, today time.Time) view.Payload {
	t.Helper()

	b := toolapi.Views()[view.Key{Tool: "get_budgets_and_goals", Form: "budget"}]
	if b == nil {
		t.Fatal("no budget builder")
	}

	p, err := b([]json.RawMessage{json.RawMessage(out)}, view.Select{}, today)
	if err != nil {
		t.Fatal(err)
	}

	return p
}

func money(amount string) string { return `{"amount":"` + amount + `","currency":"BRL"}` }

func budget(name, planned, carried, spent string) string {
	return `{"budget_id":"b-` + name + `","category_name":"` + name + `","planned":` + money(
		planned,
	) +
		`,"carried":` + money(
		carried,
	) + `,"spent":` + money(
		spent,
	) + `,"available":` + money(
		"0.00",
	) + `,"rollover":false}`
}

// November of the mock on day 19: Mercado and Restaurantes over the limit, the largest excess named.
func TestViewBudget(t *testing.T) {
	out := `{"month":"2026-11","budgets":[` +
		budget("Mercado", "1400.00", "0.00", "1512.30") + `,` +
		budget("Restaurantes", "500.00", "100.00", "718.90") + `,` +
		budget("Transporte", "500.00", "0.00", "212.40") + `,` +
		budget("Lazer", "400.00", "0.00", "95.00") + `],"goals":[]}`

	p := buildBudget(t, out, time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC))

	b, _ := json.Marshal(p.Data)

	var d budgetData
	if err := json.Unmarshal(b, &d); err != nil {
		t.Fatal(err)
	}

	if d.Day != 19 || d.Days != 30 || len(d.Items) != 4 {
		t.Fatalf("data = %+v", d)
	}

	// The limit is planned plus carried; the excess is spent over the limit.
	if d.Items[1].Name != "Restaurantes" || d.Items[1].Limit.Amount != 60000 ||
		d.Items[1].Over.Amount != 11890 ||
		d.Items[0].Over.Amount != 11230 ||
		d.Items[2].Over.Amount != 0 {
		t.Fatalf("items = %+v", d.Items)
	}

	if p.Verdict.Key != "assistantView.budget.verdict_over" ||
		*p.Verdict.Params["count"].Count != 2 ||
		p.Verdict.Params["name"].Text != "Restaurantes" ||
		p.Verdict.Params["amount"].Money.Amount != 11890 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

func TestViewBudgetWithinLimits(t *testing.T) {
	out := `{"month":"2026-10","budgets":[` + budget(
		"Lazer",
		"400.00",
		"0.00",
		"95.00",
	) + `],"goals":[]}`

	// A past month is read whole: the pace sits at its last day.
	p := buildBudget(t, out, time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC))

	b, _ := json.Marshal(p.Data)
	var d budgetData
	_ = json.Unmarshal(b, &d)

	if p.Verdict.Key != "assistantView.budget.verdict_within" || d.Day != 31 || d.Days != 31 {
		t.Fatalf("verdict = %+v, day %d of %d", p.Verdict, d.Day, d.Days)
	}

	empty := buildBudget(
		t,
		`{"month":"2026-11","budgets":[],"goals":[]}`,
		time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC),
	)
	if empty.Verdict.Key != "assistantView.budget.empty" {
		t.Fatalf("empty verdict = %+v", empty.Verdict)
	}
}

func buildPlanning(t *testing.T, tool, form, out string) view.Payload {
	t.Helper()

	b := toolapi.Views()[view.Key{Tool: tool, Form: form}]
	if b == nil {
		t.Fatalf("no builder for %s %s", tool, form)
	}

	p, err := b(
		[]json.RawMessage{json.RawMessage(out)},
		view.Select{},
		time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatal(err)
	}

	return p
}

func decodeData[T any](t *testing.T, p view.Payload) T {
	t.Helper()

	b, _ := json.Marshal(p.Data)

	var out T
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatal(err)
	}

	return out
}

func occ(id, date, desc, amount string) string {
	return `{"occurrence_id":"` + id + `","schedule_id":"s-` + id + `","description":"` + desc + `","expected_on":"` + date +
		`","expected_amount":` + money(
		amount,
	) + `,"state":"expected"}`
}

// The next 30 days of the mock, grouped in weeks that start on Monday: 7 commitments, R$ 9,037.90.
func TestViewAgenda(t *testing.T) {
	out := `{"schedules":[{"schedule_id":"s-a","description":"Fatura","kind":"bill","account_name":"Itaú","counterpart_name":"Cartão","amount":` +
		money(
			"-2918.38",
		) + `,"frequency":"monthly","match_tolerance_bp":0,"grace_days":0,"match_window_days":0}],"occurrences":[` +
		occ(
			"a",
			"2026-11-25",
			"Fatura Cartão Itaú",
			"-2918.38",
		) + `,` + occ(
		"b",
		"2026-11-28",
		"Conta de luz",
		"-187.30",
	) + `,` +
		occ(
			"c",
			"2026-12-01",
			"Escola",
			"-2003.42",
		) + `,` + occ(
		"d",
		"2026-12-05",
		"Aluguel",
		"-3200.00",
	) + `,` +
		occ(
			"e",
			"2026-12-06",
			"Internet",
			"-129.90",
		) + `,` + occ(
		"f",
		"2026-12-10",
		"Notebook",
		"-479.00",
	) + `,` +
		occ(
			"g",
			"2026-12-12",
			"Academia",
			"-119.90",
		) + `]}`

	p := buildPlanning(t, "list_schedules", "agenda", out)
	d := decodeData[struct {
		Total view.Money `json:"total"`
		Weeks []struct {
			Start  string     `json:"start"`
			Total  view.Money `json:"total"`
			Events []struct {
				Account string `json:"account"`
			} `json:"events"`
		} `json:"weeks"`
	}](t, p)

	if d.Total.Amount != -903790 || len(d.Weeks) != 3 || d.Weeks[0].Start != "2026-11-23" ||
		d.Weeks[0].Total.Amount != -310568 ||
		d.Weeks[1].Total.Amount != -533332 ||
		len(d.Weeks[1].Events) != 3 ||
		d.Weeks[0].Events[0].Account != "Itaú" {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.agenda.verdict" || *p.Verdict.Params["count"].Count != 7 ||
		p.Verdict.Params["week"].Date != "2026-11-30" {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// The Itaú account projected to the end of the year: the lowest balance, R$ 412.30 on 5/12.
func TestViewProjection(t *testing.T) {
	out := `{"account_name":"Itaú","from":"2026-11-19","to":"2026-12-31","opening":` + money(
		"2034.10",
	) + `,"closing":` + money(
		"6912.30",
	) +
		`,"points":[{"date":"2026-11-22","description":"Salário","amount":` + money(
		"6500.00",
	) + `,"balance":` + money(
		"8534.10",
	) + `},` +
		`{"date":"2026-11-25","description":"Fatura","amount":` + money(
		"-2918.38",
	) + `,"balance":` + money(
		"5615.72",
	) + `},` +
		`{"date":"2026-12-01","description":"Escola","amount":` + money(
		"-2003.42",
	) + `,"balance":` + money(
		"3612.30",
	) + `},` +
		`{"date":"2026-12-05","description":"Aluguel","amount":` + money(
		"-3200.00",
	) + `,"balance":` + money(
		"412.30",
	) + `},` +
		`{"date":"2026-12-20","description":"13º","amount":` + money(
		"6500.00",
	) + `,"balance":` + money(
		"6912.30",
	) + `}]}`

	p := buildPlanning(t, "project_balance", "balance", out)
	d := decodeData[struct {
		Opening view.Money `json:"opening"`
		Points  []struct {
			Date string `json:"date"`
		} `json:"points"`
		Low struct {
			Date    string     `json:"date"`
			Balance view.Money `json:"balance"`
		} `json:"low"`
	}](t, p)

	if d.Opening.Amount != 203410 || len(d.Points) != 5 || d.Low.Date != "2026-12-05" ||
		d.Low.Balance.Amount != 41230 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.balance.verdict_positive" ||
		p.Verdict.Params["amount"].Money.Amount != 41230 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// The trip goal of the mock: R$ 8,800 left over 8 months to 31/07/2027 asks R$ 1,100 a month.
func TestViewGoals(t *testing.T) {
	out := `{"month":"2026-11","budgets":[],"goals":[{"goal_id":"g1","name":"Viagem Japão","target":` + money(
		"15000.00",
	) +
		`,"current":` + money(
		"6200.00",
	) + `,"remaining":` + money(
		"8800.00",
	) + `,"progress_bp":4133,"due_on":"2027-07-31"}]}`

	p := buildPlanning(t, "get_budgets_and_goals", "goals", out)
	d := decodeData[struct {
		Goals []struct {
			Name    string     `json:"name"`
			Months  int        `json:"months"`
			Monthly view.Money `json:"monthly"`
		} `json:"goals"`
	}](t, p)

	if len(d.Goals) != 1 || d.Goals[0].Months != 8 || d.Goals[0].Monthly.Amount != 110000 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.goals.verdict" ||
		p.Verdict.Params["monthly"].Money.Amount != 110000 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// Six charges of the mock; the yearly cost is the last amount times the charges a year.
func TestViewRecurring(t *testing.T) {
	series := func(payee, freq, amount string, count int) string {
		return `{"key":"` + payee + `","payee":"` + payee + `","account_id":"a","account":"Nubank","frequency":"` + freq +
			`","count":` + fmt.Sprint(
			count,
		) + `,"last_date":"2026-11-05","last_amount":` + money(
			amount,
		) +
			`,"next_date":"2026-12-05","transaction_ids":[],"schedule_id":""}`
	}
	out := `{"series":[` + series(
		"Netflix",
		"monthly",
		"-55.90",
		12,
	) + `,` + series(
		"Academia",
		"monthly",
		"-119.90",
		10,
	) + `,` +
		series(
			"Amazon Prime",
			"yearly",
			"-166.80",
			1,
		) + `,` + series(
		"Feira",
		"weekly",
		"-40.00",
		30,
	) + `]}`

	p := buildPlanning(t, "find_recurring", "recurring", out)
	d := decodeData[struct {
		Total view.Money `json:"total"`
		Items []struct {
			Name   string     `json:"name"`
			Yearly view.Money `json:"yearly"`
		} `json:"items"`
	}](t, p)

	// 55.90×12 + 119.90×12 + 166.80 + 40×52 = 670.80 + 1438.80 + 166.80 + 2080.00
	if d.Total.Amount != -435640 || d.Items[0].Name != "Feira" ||
		d.Items[0].Yearly.Amount != -208000 {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.recurring.verdict" || *p.Verdict.Params["count"].Count != 4 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}
