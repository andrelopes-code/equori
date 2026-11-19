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
