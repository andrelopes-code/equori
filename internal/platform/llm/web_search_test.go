package llm_test

import (
	"context"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

// Web search design, S1: a request that asks for the search reaches a target with it only when
// the owner let that target search.
func TestClientGatesWebSearch(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		allowed bool
		asked   bool
		want    bool
	}{
		{"asked and allowed", true, true, true},
		{"asked, not allowed", false, true, false},
		{"allowed, not asked", true, false, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			a := llmtest.New("anthropic", llmtest.Step{Model: "m1", Response: text("ok")})
			res := &resolver{bindings: []llm.Binding{
				{Target: target("u1/m1"), Provider: a, WebSearch: tt.allowed},
			}}
			f := newResolvingFixture(res)

			req := prompt()
			req.WebSearch = tt.asked

			if _, err := f.router.Use(chatUse).Generate(context.Background(), req); err != nil {
				t.Fatalf("Generate: %v", err)
			}

			if got := a.Requests()[0].Request.WebSearch; got != tt.want {
				t.Fatalf("WebSearch sent = %v, want %v", got, tt.want)
			}
		})
	}
}

// S4 to S6: a paused turn is called again with its message in the conversation; the answer is
// the text and the sources of both calls, and each search is reported once.
func TestRunContinuesAPausedTurn(t *testing.T) {
	t.Parallel()

	paused := text("Searching. ")
	paused.FinishReason = llm.FinishPaused
	paused.Searches = []string{"selic rate"}
	paused.Sources = []llm.Source{{URL: "https://a.example", Title: "A"}}
	paused.Usage = llm.Usage{InputTokens: 10, OutputTokens: 2, WebSearches: 1}

	last := text("It is 10%.")
	last.Searches = []string{"selic today"}
	last.Sources = []llm.Source{
		{URL: "https://a.example", Title: "A"},
		{URL: "https://b.example", Title: "B"},
	}
	last.Usage = llm.Usage{InputTokens: 20, OutputTokens: 3, WebSearches: 1}

	a := llmtest.New(
		"a",
		llmtest.Step{Model: "m1", Response: paused},
		llmtest.Step{Model: "m1", Response: last},
	)
	f := newFixture(a)

	var searched []string

	res, err := llm.Run(
		context.Background(),
		f.router.Client(target("a/m1")),
		prompt(),
		nil,
		llm.LoopOptions{MaxSteps: 3, OnSearch: func(q string) { searched = append(searched, q) }},
	)
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	if res.Response.Text() != "Searching. It is 10%." || res.Steps != 2 {
		t.Fatalf("text = %q, steps = %d", res.Response.Text(), res.Steps)
	}

	want := []llm.Source{
		{URL: "https://a.example", Title: "A"},
		{URL: "https://b.example", Title: "B"},
	}
	if !slices.Equal(res.Response.Sources, want) {
		t.Fatalf("sources = %+v", res.Response.Sources)
	}

	if !slices.Equal(searched, []string{"selic rate", "selic today"}) {
		t.Fatalf("searched = %q", searched)
	}

	if res.Usage != (llm.Usage{InputTokens: 30, OutputTokens: 5, WebSearches: 2}) {
		t.Fatalf("usage = %+v", res.Usage)
	}

	// The second call reads the paused message, and no tool message follows it.
	sent := a.Requests()[1].Request.Messages
	if last := sent[len(sent)-1]; last.Role != llm.RoleModel ||
		last.Parts[0].Text != "Searching. " {
		t.Fatalf("second request ends with %+v", last)
	}
}
