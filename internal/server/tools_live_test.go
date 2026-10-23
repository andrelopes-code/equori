//go:build live

// The live test sends every tool declaration to the real Gemini API, which checks the schema
// keywords of ADR 012 T4, and runs one tool call through llm.RunTools:
//
//	EQUORI_GEMINI_API_KEY=... go test -tags live -run TestToolsLive ./internal/server/
package server_test

import (
	"log/slog"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/aistudio"
)

func TestToolsLive(t *testing.T) {
	t.Parallel()
	key := os.Getenv("EQUORI_GEMINI_API_KEY")
	if key == "" {
		t.Fatal("EQUORI_GEMINI_API_KEY is not set")
	}
	model := os.Getenv("EQUORI_GEMINI_LIVE_MODEL")
	if model == "" {
		model = "gemini-3.5-flash-lite"
	}
	h := apitest.New(t)
	h.Account("Checking", "asset", "checking", nil)

	var names []string
	for _, tl := range h.App.Tools.Tools() {
		names = append(names, tl.Spec().Name)
	}
	set, err := h.App.Tools.Select(names...)
	if err != nil {
		t.Fatal(err)
	}
	tools, handlers := set.LLM()
	clk := clock.New(time.UTC, time.Now)
	p := aistudio.New("https://generativelanguage.googleapis.com", key, &http.Client{Timeout: time.Minute})
	client := llm.NewRouter(&clk, slog.New(slog.NewTextHandler(os.Stderr, nil)), nil, p).Client(llm.Target{Provider: "aistudio", Model: model})
	req := llm.Request{
		Tools: tools,
		Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{{
			Text: "Call list_accounts once, then reply with the names of my asset accounts.",
		}}}},
	}
	resp, _, err := llm.RunTools(auth.WithUserID(t.Context(), h.OwnerID()), client, req, handlers, 4)
	if err != nil {
		t.Fatalf("Gemini rejected the catalog or the loop failed: %v", err)
	}
	if !strings.Contains(h.Logs(), "tool=list_accounts") || !strings.Contains(resp.Text(), "Checking") {
		t.Fatalf("answer %q; logs:\n%s", resp.Text(), h.Logs())
	}
}
