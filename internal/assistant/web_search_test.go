package assistant_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// searchChain makes the chat a chain of one target of a custom provider with capabilities, and
// returns the provider's script.
func searchChain(
	t *testing.T,
	h *apitest.Harness,
	f *fakes,
	capabilities []string,
	answer llmtest.Step,
) *llmtest.Provider {
	t.Helper()

	p := createProvider(t, h, h.Client, map[string]any{
		"preset": "custom", "name": "Search", "base_url": "http://127.0.0.1:9/v1", "key": "kw",
	})
	h.MustDo(http.MethodPut, "/api/v1/assistant/uses/assistant.chat/chain", map[string]any{
		"targets": []any{map[string]any{
			"provider_id": p.ID, "model": "search-1", "capabilities": capabilities,
		}},
	}, http.StatusOK, nil)

	answer.Model = "search-1"

	return f.script("kw", answer)
}

// Web search design, S1, S6 to S8: on a target the owner let search, the turn asks for the
// search, tells the model its rules, reports each search as a step and shows the sources as a
// view whose addresses the provider returned.
func TestTurnSearchesTheWeb(t *testing.T) {
	t.Parallel()

	f := newFakes()
	h := harness(t, f, apitest.Today("2026-10-23"))

	answer := textStep("A Selic está em 10%.")
	answer.Response.Searches = []string{"taxa selic hoje"}
	answer.Response.Sources = []llm.Source{
		{URL: "https://bcb.example/selic", Title: "Banco Central"},
		{URL: "javascript:alert(1)", Title: "x"},
		{URL: "http://news.example/juros", Title: ""},
	}
	answer.Response.Usage.WebSearches = 1
	web := searchChain(t, h, f, []string{"tools", "web_search"}, answer)

	r := sendTurn(h, h.Client, map[string]any{"text": "Qual a Selic hoje?"})
	if r.Status != http.StatusOK {
		t.Fatalf("turn = %d: %s", r.Status, r.Body)
	}

	req := web.Requests()[0].Request
	if !req.WebSearch || !strings.Contains(req.System, "\nWeb\n") {
		t.Fatalf("web search = %v; the prompt has the section Web: %v",
			req.WebSearch, strings.Contains(req.System, "\nWeb\n"))
	}

	events := parseSSE(r.Body)

	var steps []string
	for _, e := range events {
		if e.Name == "step" {
			steps = append(steps, e.Data)
		}
	}

	if len(steps) != 1 || !strings.Contains(steps[0], `"web_search"`) {
		t.Fatalf("steps = %v", steps)
	}

	var got struct {
		Views []struct {
			Form    string `json:"form"`
			Payload struct {
				Title struct {
					Key string `json:"key"`
				} `json:"title"`
				Verdict struct {
					Params map[string]struct {
						Count *int64 `json:"count"`
					} `json:"params"`
				} `json:"verdict"`
				Rows struct {
					Rows [][]struct {
						Text string `json:"text"`
					} `json:"rows"`
				} `json:"rows"`
				Data struct {
					Sources []struct {
						URL   string `json:"url"`
						Title string `json:"title"`
					} `json:"sources"`
				} `json:"data"`
			} `json:"payload"`
		} `json:"views"`
	}
	if err := json.Unmarshal([]byte(events[len(events)-1].Data), &got); err != nil {
		t.Fatal(err)
	}

	if len(got.Views) != 1 || got.Views[0].Form != "sources" {
		t.Fatalf("views = %s", events[len(events)-1].Data)
	}

	p := got.Views[0].Payload
	if p.Title.Key != "assistantView.sources.title" || *p.Verdict.Params["count"].Count != 2 ||
		len(p.Rows.Rows) != 2 || p.Rows.Rows[0][0].Text != "Banco Central" ||
		p.Rows.Rows[0][1].Text != "https://bcb.example/selic" {
		t.Fatalf("payload = %+v", p)
	}

	// A source without a title is named by its host; an address that is not http or https is
	// left out.
	if len(p.Data.Sources) != 2 || p.Data.Sources[1].Title != "news.example" ||
		p.Data.Sources[1].URL != "http://news.example/juros" {
		t.Fatalf("sources = %+v", p.Data.Sources)
	}
}

// S1, S2, S8: a target without the owner's permission gets no search and no section Web.
func TestTurnWithoutWebSearch(t *testing.T) {
	t.Parallel()

	f := newFakes()
	h := harness(t, f, apitest.Today("2026-10-23"))
	plain := searchChain(t, h, f, []string{"tools"}, textStep("Não sei."))

	r := sendTurn(h, h.Client, map[string]any{"text": "Qual a Selic hoje?"})
	if r.Status != http.StatusOK {
		t.Fatalf("turn = %d: %s", r.Status, r.Body)
	}

	req := plain.Requests()[0].Request
	if req.WebSearch || strings.Contains(req.System, "\nWeb\n") {
		t.Fatalf("web search = %v; the prompt has the section Web: %v",
			req.WebSearch, strings.Contains(req.System, "\nWeb\n"))
	}
}

// S2: a chain target holds the capability web_search and no capability outside the set.
func TestSchemaChainTargetCapabilities(t *testing.T) {
	t.Parallel()

	pool := pgtest.New(t)
	ctx := t.Context()
	_, books := pgtest.CreateMember(t, pool)

	const provider = "11111111-1111-1111-1111-111111111111"
	if _, err := pool.Exec(
		ctx,
		`INSERT INTO assistant_provider (id, books_id, preset, name, base_url, created_at)
		VALUES ($1, $2, 'ollama', 'Local', 'http://127.0.0.1:11434/v1', now())`,
		provider,
		books,
	); err != nil {
		t.Fatal(err)
	}

	target := `INSERT INTO assistant_chain_target
		(books_id, use_id, position, provider_id, model, capabilities)
		VALUES ($1, 'assistant.chat', $2, $3, 'm', $4)`

	if _, err := pool.Exec(
		ctx,
		target,
		books,
		0,
		provider,
		[]string{"tools", "web_search"},
	); err != nil {
		t.Fatalf("web_search is refused: %v", err)
	}

	_, err := pool.Exec(ctx, target, books, 1, provider, []string{"browse"})

	var pg *pgconn.PgError
	if !errors.As(err, &pg) || pg.Code != checkViolation {
		t.Fatalf("an unknown capability is accepted: %v", err)
	}
}
