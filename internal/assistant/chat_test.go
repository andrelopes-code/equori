package assistant_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

type chatView struct {
	Available    bool       `json:"available"`
	ProviderName string     `json:"provider_name"`
	Model        string     `json:"model"`
	Notice       string     `json:"notice"`
	RetryAt      *time.Time `json:"retry_at"`
}

func chatState(t *testing.T, h *apitest.Harness) chatView {
	t.Helper()
	var v chatView
	h.MustDo(http.MethodGet, "/api/v1/assistant/chat", nil, http.StatusOK, &v)
	return v
}

func TestChatState(t *testing.T) {
	t.Parallel()
	t.Run("instance provider", func(t *testing.T) {
		t.Parallel()
		h := apitest.New(t, apitest.LLM(llmtest.New("aistudio")))
		want := chatView{Available: true, ProviderName: "aistudio", Model: "gemini-3.5-flash-lite", Notice: "trains"}
		if got := chatState(t, h); got != want {
			t.Fatalf("state = %+v, want %+v", got, want)
		}
	})
	t.Run("every target cooling", func(t *testing.T) {
		t.Parallel()
		quota := func(model string) llmtest.Step {
			return llmtest.Step{Model: model, Err: &llm.QuotaError{RetryAfter: time.Hour}}
		}
		h := apitest.New(t, apitest.LLM(llmtest.New("aistudio", quota("gemini-3.5-flash-lite"), quota("gemini-3.5-flash"))))
		ctx := auth.WithUserID(t.Context(), h.OwnerID())
		_, _ = h.App.LLM.Use(assistant.ChatUse).Generate(ctx, llm.Request{Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{{Text: "x"}}}}})
		var rows struct {
			Items []usageView `json:"items"`
		}
		h.MustDo(http.MethodGet, "/api/v1/assistant/usage", nil, http.StatusOK, &rows)
		if len(rows.Items) != 2 || rows.Items[0].CoolingUntil == nil || rows.Items[1].CoolingUntil == nil {
			t.Fatalf("usage = %+v", rows.Items)
		}
		earliest := *rows.Items[0].CoolingUntil
		if c := *rows.Items[1].CoolingUntil; c.Before(earliest) {
			earliest = c
		}
		got := chatState(t, h)
		if got.Available || got.ProviderName != "" || got.RetryAt == nil || !got.RetryAt.Equal(earliest) {
			t.Fatalf("state = %+v, want unavailable until %v", got, earliest)
		}
	})
	t.Run("no provider", func(t *testing.T) {
		t.Parallel()
		h := apitest.New(t)
		if got := chatState(t, h); got != (chatView{}) {
			t.Fatalf("state = %+v, want only available=false", got)
		}
	})
}
