package assistant_test

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/llm"
)

// S138: a request limit stops the target of the user who declared it and nobody else.
func TestDailyLimitS138(t *testing.T) {
	t.Parallel()
	f := newFakes()
	h := harness(t, f, apitest.Today("2026-10-23"))
	other := h.Login("other@example.com")
	var otherID int64
	if err := h.Pool.QueryRow(t.Context(), `SELECT id FROM identity_user WHERE email = 'other@example.com'`).Scan(&otherID); err != nil {
		t.Fatal(err)
	}
	answer := structured("ok")
	answer.Model = "gemini-3.5-flash"
	providers := map[string]string{}
	for key, c := range map[string]*http.Client{"ka": h.Client, "kb": other} {
		p := createProvider(t, h, c, map[string]any{"preset": "gemini", "name": "Gemini", "key": key})
		providers[key] = p.ID
		h.Call(c, http.MethodPut, "/api/v1/assistant/uses/assistant.chat/chain", map[string]any{"targets": []any{
			map[string]any{"provider_id": p.ID, "model": "gemini-3.5-flash", "capabilities": []string{"tools"}},
		}})
	}
	owner := f.script("ka", answer, answer)
	f.script("kb", answer, answer)
	h.MustDo(http.MethodPut, "/api/v1/assistant/usage/limits", map[string]any{
		"provider_id": providers["ka"], "model": "gemini-3.5-flash", "requests_per_day": 1,
	}, http.StatusNoContent, nil)

	req := llm.Request{Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{{Text: "x"}}}}}
	client := h.App.LLM.Use(assistant.ChatUse)
	ctx := auth.WithUserID(t.Context(), h.OwnerID())
	if _, err := client.Generate(ctx, req); err != nil {
		t.Fatalf("first call: %v", err)
	}
	_, err := client.Generate(ctx, req)
	exhausted, ok := errors.AsType[*llm.ExhaustedError](err)
	if !ok || !errors.Is(err, llm.ErrExhausted) || !exhausted.RetryAt.Equal(time.Date(2026, 10, 24, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("second call error = %v", err)
	}
	if n := len(owner.Requests()); n != 1 {
		t.Fatalf("provider received %d requests, want 1", n)
	}
	for range 2 {
		if _, err := client.Generate(auth.WithUserID(t.Context(), otherID), req); err != nil {
			t.Fatalf("other user's call: %v", err)
		}
	}
}
