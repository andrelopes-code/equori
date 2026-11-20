package assistant_test

import (
	"encoding/json"
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

type chatTarget struct {
	ProviderID   string `json:"provider_id"`
	ProviderName string `json:"provider_name"`
	Model        string `json:"model"`
	Notice       string `json:"notice"`
	ReadsFiles   bool   `json:"reads_files"`
}

// MC1: the chat lists the targets of its chain in order.
func TestChatTargets(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.LLM(llmtest.New("aistudio")))

	var got struct {
		Targets []chatTarget `json:"targets"`
	}
	h.MustDo(http.MethodGet, "/api/v1/assistant/chat", nil, http.StatusOK, &got)

	want := []chatTarget{
		{"aistudio", "aistudio", "gemini-3.5-flash", "trains", false},
		{"aistudio", "aistudio", "gemini-3.5-flash-lite", "trains", false},
		{"aistudio", "aistudio", "gemini-3.1-flash-lite", "trains", false},
	}
	if !slices.Equal(got.Targets, want) {
		t.Fatalf("targets = %+v, want %+v", got.Targets, want)
	}
}

// S660: a chosen target answers the turn instead of the first target of the chain.
func TestTurnChosenTarget(t *testing.T) {
	t.Parallel()

	lite := "gemini-3.5-flash-lite"
	p := llmtest.New("aistudio", llmtest.Step{Model: lite, Response: textStep("ok").Response})
	h := turnHarness(t, p)

	r := sendTurn(h, h.Client, map[string]any{
		"text":   "oi",
		"target": map[string]string{"provider_id": "aistudio", "model": lite},
	})
	events := parseSSE(r.Body)
	last := events[len(events)-1]

	var answer turnAnswer
	if r.Status != http.StatusOK || last.Name != "answer" ||
		json.Unmarshal([]byte(last.Data), &answer) != nil || answer.Content != "ok" {
		t.Fatalf("status = %d, events = %s", r.Status, r.Body)
	}

	var models []string
	for _, c := range p.Requests() {
		models = append(models, c.Model)
	}

	if !slices.Equal(models, []string{lite}) {
		t.Fatalf("models = %v, want [%s]", models, lite)
	}
}

// S661: a chosen target in cooldown answers assistant_exhausted; no other target replaces it.
func TestTurnChosenTargetCooling(t *testing.T) {
	t.Parallel()

	p := llmtest.New(
		"aistudio",
		llmtest.Step{Model: chatModel, Err: &llm.QuotaError{RetryAfter: time.Hour}},
		llmtest.Step{Model: "gemini-3.5-flash-lite", Response: textStep("x").Response},
	)
	h := turnHarness(t, p)
	ctx := auth.WithBooksID(t.Context(), h.OwnerID())
	_, _ = h.App.LLM.Use(assistant.ChatUse).
		Generate(ctx, llm.Request{Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{{Text: "x"}}}}})
	before := len(p.Requests())

	r := sendTurn(h, h.Client, map[string]any{
		"text":   "oi",
		"target": map[string]string{"provider_id": "aistudio", "model": chatModel},
	})

	h.ExpectProblem(r, http.StatusTooManyRequests, "assistant_exhausted", "")

	var d struct {
		RetryAt *time.Time `json:"retry_at"`
	}
	r.Decode(t, &d)

	if d.RetryAt == nil {
		t.Fatalf("no retry_at: %s", r.Body)
	}

	if n := len(p.Requests()) - before; n != 0 {
		t.Fatalf("provider received %d requests", n)
	}
}

// S662: a target outside the chain is refused before the stream and stores no conversation.
func TestTurnUnknownTarget(t *testing.T) {
	t.Parallel()

	p := llmtest.New("aistudio")
	h := turnHarness(t, p)

	r := sendTurn(h, h.Client, map[string]any{
		"text":   "oi",
		"target": map[string]string{"provider_id": "aistudio", "model": "unknown-model"},
	})

	h.ExpectProblem(r, http.StatusUnprocessableEntity, "assistant_target_unknown", "target")

	var list struct {
		Items []json.RawMessage `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/assistant/conversations", nil, http.StatusOK, &list)

	if len(list.Items) != 0 || len(p.Requests()) != 0 {
		t.Fatalf("conversations = %d, requests = %d", len(list.Items), len(p.Requests()))
	}
}

// MC2: a chosen target that does not read files gets the descriptor only, though another target of
// the chain reads them.
func TestTurnChosenTargetFiles(t *testing.T) {
	t.Parallel()

	f := newFakes()
	h := harness(t, f, apitest.Today("2026-10-23"))
	p := createProvider(t, h, h.Client, map[string]any{
		"preset": "custom", "name": "Mixed", "base_url": "http://127.0.0.1:9/v1", "key": "km",
	})
	h.MustDo(http.MethodPut, "/api/v1/assistant/uses/assistant.chat/chain", map[string]any{
		"targets": []any{
			map[string]any{
				"provider_id":  p.ID,
				"model":        "vision-1",
				"capabilities": []string{"tools", "image_input"},
			},
			map[string]any{
				"provider_id":  p.ID,
				"model":        "text-1",
				"capabilities": []string{"tools"},
			},
		},
	}, http.StatusOK, nil)

	var chat struct {
		Targets []chatTarget `json:"targets"`
	}
	h.MustDo(http.MethodGet, "/api/v1/assistant/chat", nil, http.StatusOK, &chat)

	if len(chat.Targets) != 2 || !chat.Targets[0].ReadsFiles || chat.Targets[1].ReadsFiles {
		t.Fatalf("targets = %+v, want vision-1 reading files and text-1 not", chat.Targets)
	}

	answer := textStep("Não li.")
	answer.Model = "text-1"
	mixed := f.script("km", answer)
	file := uploadFile(t, h, h.Client, nil, "nota.pdf", []byte("%PDF-1.7"), http.StatusCreated)

	r := sendTurn(h, h.Client, map[string]any{
		"text":     "Lê a nota",
		"file_ids": []string{file.ID},
		"target":   map[string]string{"provider_id": p.ID, "model": "text-1"},
	})

	reqs := mixed.Requests()
	if r.Status != http.StatusOK || len(reqs) != 1 {
		t.Fatalf("status = %d, requests = %d: %s", r.Status, len(reqs), r.Body)
	}

	if req := reqs[0].Request; req.HasFiles() {
		t.Error("a file part reached a chosen model that does not read files")
	}
}
