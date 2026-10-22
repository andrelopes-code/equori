package capture_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

type suggestionsView struct {
	Available bool `json:"available"`
	Items     []struct {
		CategoryID string `json:"category_id"`
		Source     string `json:"source"`
	} `json:"items"`
}

func answer(text string) llmtest.Step {
	return llmtest.Step{Model: "gemini-3.5-flash-lite", Response: llm.Response{
		Message:      llm.Message{Role: llm.RoleModel, Parts: []llm.Part{{Text: text}}},
		FinishReason: llm.FinishStop,
	}}
}

func (b books) suggest(t *testing.T, items ...map[string]string) suggestionsView {
	t.Helper()
	var out suggestionsView
	b.h.MustDo(http.MethodPost, "/api/v1/capture/suggestions", map[string]any{"items": items}, http.StatusOK, &out)
	return out
}

func item(description, kind string) map[string]string {
	return map[string]string{"description": description, "kind": kind}
}

// ADR 014: one call for the descriptions not kept, the answer kept per description, and a
// category of the other class never named.
func TestSuggestCategories(t *testing.T) {
	t.Parallel()
	provider := llmtest.New("aistudio",
		// Options in class and path order: 1 Supermarket, 2 Transport (expense).
		answer(`{"items":[{"description":1,"category":1},{"description":2,"category":2},{"description":3,"category":9}]}`),
	)
	b := newBooks(t, apitest.LLM(provider))

	got := b.suggest(t, item("Padaria São João", "expense"), item("Freela", "income"), item("Cinema", "expense"))
	if !got.Available || len(got.Items) != 3 || got.Items[0].CategoryID != b.supermarket || got.Items[0].Source != "model" ||
		got.Items[1].CategoryID != "" || got.Items[2].CategoryID != "" {
		t.Fatalf("suggestions = %+v", got)
	}
	calls := provider.Requests()
	if len(calls) != 1 {
		t.Fatalf("calls = %d, want 1", len(calls))
	}
	prompt := calls[0].Request.Messages[0].Parts[0].Text
	for _, want := range []string{"1. [expense] Supermarket\n", "2. [expense] Transport\n", "1. [expense] Padaria São João\n", "2. [income] Freela\n"} {
		if !strings.Contains(prompt, want) {
			t.Errorf("prompt lacks %q:\n%s", want, prompt)
		}
	}
	if calls[0].Request.Schema == nil {
		t.Error("request carries no response schema")
	}

	// Kept answers, a category and two "none", are served without a call; the provider has no
	// step left, so a call would fail the request.
	again := b.suggest(t, item("padaria sao joao", "expense"), item("FREELA", "income"), item("cinema", "expense"))
	if !again.Available || again.Items[0].CategoryID != b.supermarket || again.Items[0].Source != "kept" ||
		again.Items[1].CategoryID != "" || again.Items[2].CategoryID != "" {
		t.Fatalf("kept = %+v", again)
	}
	if len(provider.Requests()) != 1 {
		t.Fatalf("calls = %d, want 1", len(provider.Requests()))
	}
}

func TestSuggestCategoriesWithoutModel(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	got := b.suggest(t, item("Padaria", "expense"))
	if got.Available || len(got.Items) != 1 || got.Items[0].CategoryID != "" {
		t.Fatalf("suggestions = %+v", got)
	}
	b.h.ExpectProblem(b.h.Do(http.MethodPost, "/api/v1/capture/suggestions", map[string]any{"items": []any{}}),
		http.StatusBadRequest, "invalid_request", "items")
}

// A quota refusal keeps nothing; while the target cools down the answer stays unavailable.
func TestSuggestCategoriesAfterQuota(t *testing.T) {
	t.Parallel()
	provider := llmtest.New("aistudio",
		llmtest.Step{Model: "gemini-3.5-flash-lite", Err: &llm.QuotaError{}},
	)
	b := newBooks(t, apitest.LLM(provider))
	if got := b.suggest(t, item("Padaria", "expense")); got.Available || got.Items[0].CategoryID != "" {
		t.Fatalf("suggestions = %+v", got)
	}
	if got := b.suggest(t, item("Padaria", "expense")); got.Available {
		t.Fatalf("suggestions = %+v", got)
	}
}
