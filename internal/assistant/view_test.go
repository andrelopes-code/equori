package assistant_test

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

// toolResults returns the tool results the model received in its last request, in order.
func toolResults(p *llmtest.Provider) []llm.ToolResult {
	reqs := p.Requests()

	var out []llm.ToolResult
	for _, m := range reqs[len(reqs)-1].Request.Messages {
		for _, part := range m.Parts {
			if part.ToolResult != nil {
				out = append(out, *part.ToolResult)
			}
		}
	}

	return out
}

const helpArgs = `{"topic":"reports"}`

// V1: a read output reaches the model with its view_source handle.
func TestShowStampsSource(t *testing.T) {
	t.Parallel()

	p := llmtest.New("aistudio", callStep("get_help", helpArgs), textStep("ok"))
	h := turnHarness(t, p)

	if r := sendTurn(
		h,
		h.Client,
		map[string]any{"text": "Como uso o assistente?"},
	); r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	res := toolResults(p)
	if len(res) != 1 {
		t.Fatalf("results = %+v", res)
	}

	var out struct {
		ViewSource string `json:"view_source"`
		Topic      string `json:"topic"`
	}
	if err := json.Unmarshal(
		res[0].Content,
		&out,
	); err != nil || out.ViewSource != "r1" ||
		out.Topic != "reports" {
		t.Fatalf("result = %s", res[0].Content)
	}
}

// V2, V3, V5: show refuses an unknown handle, a form the source does not draw and a fourth view.
func TestShowRefuses(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name, args, want string
		calls            int
	}{
		{"unknown handle", `{"source":["r9"],"form":"help"}`, "r1", 1},
		{"form not drawn", `{"source":["r1"],"form":"ranking"}`, "help", 1},
		{"two handles", `{"source":["r1","r1"],"form":"help"}`, "source", 1},
		{"fourth view", `{"source":["r1"],"form":"help"}`, "at most 3 views", 4},
		// V27, V29: form chart takes a spec, and a handle once.
		{"chart without spec", `{"source":["r1"],"form":"chart"}`, "takes a chart spec", 1},
		{"handle twice", `{"source":["r1","r1"],"form":"chart"}`, "given twice", 1},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			steps := []llmtest.Step{callStep("get_help", helpArgs)}
			for range c.calls {
				steps = append(steps, callStep("show", c.args))
			}

			p := llmtest.New("aistudio", append(steps, textStep("ok"))...)
			h := turnHarness(t, p)

			if r := sendTurn(
				h,
				h.Client,
				map[string]any{"text": "Ajuda"},
			); r.Status != http.StatusOK {
				t.Fatalf("status = %d: %s", r.Status, r.Body)
			}

			res := toolResults(p)

			last := res[len(res)-1]
			if !last.IsError || !strings.Contains(string(last.Content), c.want) {
				t.Fatalf("show result = %+v %s", last, last.Content)
			}
		})
	}
}

type viewAnswer struct {
	ID    string `json:"id"`
	Views []struct {
		ID      string `json:"id"`
		Form    string `json:"form"`
		Payload struct {
			Verdict struct {
				Key string `json:"key"`
			} `json:"verdict"`
			Next []string `json:"next"`
		} `json:"payload"`
	} `json:"views"`
}

// V9: the views of an answer reach the stream and stay with the stored message.
func TestShowStoresView(t *testing.T) {
	t.Parallel()

	p := llmtest.New(
		"aistudio",
		callStep("get_help", helpArgs),
		callStep("show", `{"source":["r1"],"form":"help","next":["Onde vejo relatórios?"]}`),
		textStep("Veja os passos."),
	)
	h := turnHarness(t, p)

	r := sendTurn(h, h.Client, map[string]any{"text": "Como vejo relatórios?"})
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	events := parseSSE(r.Body)
	last := events[len(events)-1]

	var streamed viewAnswer
	if err := json.Unmarshal([]byte(last.Data), &streamed); err != nil || last.Name != "answer" {
		t.Fatalf("last event = %s %s", last.Name, last.Data)
	}

	var turn struct {
		ConversationID string `json:"conversation_id"`
	}
	if err := json.Unmarshal([]byte(events[0].Data), &turn); err != nil {
		t.Fatal(err)
	}

	var d struct {
		Messages []viewAnswer `json:"messages"`
	}
	h.MustDo(
		http.MethodGet,
		"/api/v1/assistant/conversations/"+turn.ConversationID,
		nil,
		http.StatusOK,
		&d,
	)

	stored := d.Messages[1]
	for _, m := range []viewAnswer{streamed, stored} {
		if len(m.Views) != 1 || m.Views[0].Form != "help" ||
			m.Views[0].Payload.Verdict.Key != "assistantView.help.verdict" ||
			len(
				m.Views[0].Payload.Next,
			) != 1 || m.Views[0].Payload.Next[0] != "Onde vejo relatórios?" {
			t.Fatalf("message views = %+v", m)
		}
	}

	if d.Messages[0].Views == nil || len(d.Messages[0].Views) != 0 {
		t.Fatalf("user message views = %+v, want []", d.Messages[0].Views)
	}
}

// V3: the server registers the views of the other modules' reads.
func TestShowRankingOfReporting(t *testing.T) {
	t.Parallel()

	p := llmtest.New(
		"aistudio",
		callStep(
			"get_category_totals",
			`{"class":"expense","from":"2026-10-01","to":"2026-10-31"}`,
		),
		callStep("show", `{"source":["r1"],"form":"ranking"}`),
		textStep("Nada em outubro."),
	)
	h := turnHarness(t, p)

	r := sendTurn(h, h.Client, map[string]any{"text": "Onde gastei em outubro?"})
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	events := parseSSE(r.Body)

	var answer viewAnswer
	if err := json.Unmarshal([]byte(events[len(events)-1].Data), &answer); err != nil {
		t.Fatal(err)
	}

	if len(answer.Views) != 1 || answer.Views[0].Form != "ranking" ||
		answer.Views[0].Payload.Verdict.Key != "assistantView.ranking.empty" {
		t.Fatalf("views = %+v; results %+v", answer.Views, toolResults(p))
	}
}

// The owner's request of 2026-11-21 (V27 to V35): the income of one account by month of the
// year, from get_account_history, which no form draws.
func TestShowChartOfAccountHistory(t *testing.T) {
	t.Parallel()

	spec := `{"title":"Entradas de Algum dinheiro em 2026","items":"days",` +
		`"x":{"field":"date","bucket":"month","from":"2026-08-01","to":"2026-10-31"},` +
		`"series":[{"field":"inflow","agg":"sum","kind":"bar","label":"Entradas","tone":"success"}],` +
		`"average":[0]}`
	late := &lateProvider{}
	h := apitest.New(t, apitest.LLM(late), apitest.Today("2026-10-23"))

	account := h.Account("Algum dinheiro", "asset", "checking", nil)
	salary := h.Account("Salary", "income", "", nil)
	h.Record("2026-08-05", h.Posting(account, 60000), h.Posting(salary, -60000))
	h.Record("2026-10-06", h.Posting(account, 40000), h.Posting(salary, -40000))
	h.Record("2026-10-20", h.Posting(account, 2550), h.Posting(salary, -2550))
	h.Dispatch()

	history := `{"account_id":"` + account + `","view":"flows","from":"2026-01-01","to":"2026-10-31"}`
	late.p = llmtest.New("aistudio",
		callStep("get_account_history", history),
		callStep("show", `{"source":["r1"],"form":"chart","chart":`+spec+`}`),
		textStep("Outubro somou mais."),
	)
	p := late.p

	r := sendTurn(h, h.Client, map[string]any{"text": "Gráfico dos meus rendimentos por mês"})
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	events := parseSSE(r.Body)

	var answer struct {
		Views []struct {
			Form    string `json:"form"`
			Payload struct {
				Rows struct {
					Rows [][]struct {
						Month string `json:"month"`
						Money *struct {
							Amount int64 `json:"amount"`
						} `json:"money"`
					} `json:"rows"`
				} `json:"rows"`
				Plot *struct {
					Series []struct {
						Kind string `json:"kind"`
						Tone string `json:"tone"`
					} `json:"series"`
					Marks []struct {
						Value struct {
							Money struct {
								Amount int64 `json:"amount"`
							} `json:"money"`
						} `json:"value"`
					} `json:"marks"`
				} `json:"plot"`
			} `json:"payload"`
		} `json:"views"`
	}
	if err := json.Unmarshal([]byte(events[len(events)-1].Data), &answer); err != nil {
		t.Fatal(err)
	}

	if len(answer.Views) != 1 || answer.Views[0].Form != "chart" ||
		answer.Views[0].Payload.Plot == nil {
		t.Fatalf("views = %+v; results %+v", answer.Views, toolResults(p))
	}

	// August 600.00, September 0, October 425.50; the mean 1025.50 / 3 = 341.83.
	got := []string{}
	for _, row := range answer.Views[0].Payload.Rows.Rows {
		got = append(got, row[0].Month+" "+strconv.FormatInt(row[1].Money.Amount, 10))
	}

	if strings.Join(got, ",") != "2026-08 60000,2026-09 0,2026-10 42550" {
		t.Fatalf("rows = %v", got)
	}

	plot := answer.Views[0].Payload.Plot
	if plot.Series[0].Kind != "bar" || plot.Series[0].Tone != "success" ||
		len(plot.Marks) != 1 || plot.Marks[0].Value.Money.Amount != 34183 {
		t.Fatalf("plot = %+v", plot)
	}

	// V37: the model reads the rows the server computed, amounts as decimals of their currency.
	results := toolResults(p)
	shown := string(results[len(results)-1].Content)

	want := `"head":["x","Entradas"],"rows":[` +
		`["2026-08",{"amount":"600.00","currency":"BRL"}],` +
		`["2026-09",{"amount":"0.00","currency":"BRL"}],` +
		`["2026-10",{"amount":"425.50","currency":"BRL"}]],` +
		`"average":[{"amount":"341.83","currency":"BRL"}]`
	if !strings.Contains(shown, want) {
		t.Fatalf("show result = %s", shown)
	}
}

// V39, V40: a chart of a paged read follows the pages itself, and reads the postings of each
// transaction; the model passes the first page alone.
func TestShowChartFollowsPages(t *testing.T) {
	t.Parallel()

	spec := `{"title":"Gastos por mês","items":"transactions.postings",` +
		`"where":[{"field":"account_class","op":"eq","value":"expense"}],` +
		`"x":{"field":"date","bucket":"month"},` +
		`"series":[{"field":"amount","agg":"sum","kind":"bar","label":"Gasto"}]}`
	late := &lateProvider{}
	h := apitest.New(t, apitest.LLM(late), apitest.Today("2026-10-23"))

	account := h.Account("Conta", "asset", "checking", nil)
	food := h.Account("Mercado", "expense", "", nil)
	h.Record("2026-08-05", h.Posting(account, -1000), h.Posting(food, 1000))
	h.Record("2026-08-20", h.Posting(account, -2000), h.Posting(food, 2000))
	h.Record("2026-09-06", h.Posting(account, -3000), h.Posting(food, 3000))
	h.Record("2026-10-01", h.Posting(account, -4000), h.Posting(food, 4000))
	h.Record("2026-10-20", h.Posting(account, -550), h.Posting(food, 550))
	h.Dispatch()

	late.p = llmtest.New("aistudio",
		callStep("search_transactions", `{"limit":2}`),
		callStep("show", `{"source":["r1"],"form":"chart","chart":`+spec+`}`),
		textStep("Outubro somou mais."),
	)
	p := late.p

	r := sendTurn(h, h.Client, map[string]any{"text": "Gráfico dos meus gastos por mês"})
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	results := toolResults(p)
	shown := string(results[len(results)-1].Content)

	want := `"rows":[` +
		`["2026-08",{"amount":"30.00","currency":"BRL"}],` +
		`["2026-09",{"amount":"30.00","currency":"BRL"}],` +
		`["2026-10",{"amount":"45.50","currency":"BRL"}]]`
	if !strings.Contains(shown, want) {
		t.Fatalf("show result = %s", shown)
	}
}
