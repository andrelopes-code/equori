package assistant_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

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
