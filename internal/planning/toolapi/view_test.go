package toolapi_test

import (
	"encoding/json"
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
