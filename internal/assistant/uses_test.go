package assistant_test

import (
	"errors"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/capture"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

type useView struct {
	ID                 string   `json:"id"`
	Needs              []string `json:"needs"`
	SendsFinancialData bool     `json:"sends_financial_data"`
	Default            bool     `json:"default"`
	Targets            []struct {
		ProviderID   string   `json:"provider_id"`
		ProviderName string   `json:"provider_name"`
		Notice       string   `json:"notice"`
		Model        string   `json:"model"`
		Capabilities []string `json:"capabilities"`
	} `json:"targets"`
}

func (u useView) chain() []string {
	var out []string
	for _, t := range u.Targets {
		out = append(out, t.ProviderName+"/"+t.Model+"/"+t.Notice)
	}
	return out
}

func uses(t *testing.T, h *apitest.Harness) map[string]useView {
	t.Helper()
	var list struct {
		Items []useView `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/assistant/uses", nil, http.StatusOK, &list)
	out := map[string]useView{}
	for _, u := range list.Items {
		out[u.ID] = u
	}
	return out
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// A5: default chains resolved against the user's providers and the instance provider.
func TestListUsesA5(t *testing.T) {
	t.Parallel()
	h := harness(t, newFakes())
	createProvider(t, h, h.Client, map[string]any{"preset": "groq", "name": "Groq", "key": "k"})
	got := uses(t, h)
	suggest, chat := got["capture.suggest"], got["assistant.chat"]
	if !suggest.Default || !suggest.SendsFinancialData || !equal(suggest.Needs, []string{"structured_output"}) ||
		!equal(suggest.chain(), []string{"aistudio/gemini-3.5-flash-lite/trains"}) {
		t.Fatalf("capture.suggest = %+v", suggest)
	}
	if !chat.Default || !equal(chat.chain(), []string{"aistudio/gemini-3.5-flash-lite/trains", "aistudio/gemini-3.1-flash-lite/trains", "aistudio/gemini-3.5-flash/trains", "Groq/openai/gpt-oss-120b/provider_terms"}) {
		t.Fatalf("assistant.chat = %+v", chat)
	}
}

// A6, A11: capability check, explicit chain, default restored by an empty list and by
// deleting the provider.
func TestSetUseChainA6A11(t *testing.T) {
	t.Parallel()
	h := harness(t, newFakes())
	p := createProvider(t, h, h.Client, map[string]any{"preset": "custom", "name": "Box", "base_url": "http://10.0.0.2:8000/v1"})
	path := "/api/v1/assistant/uses/assistant.chat/chain"
	target := func(model string, caps ...string) map[string]any {
		return map[string]any{"provider_id": p.ID, "model": model, "capabilities": caps}
	}
	h.ExpectProblem(h.Do(http.MethodPut, path, map[string]any{"targets": []any{target("plain")}}),
		http.StatusUnprocessableEntity, "capability_missing", "targets")
	h.ExpectProblem(h.Do(http.MethodPut, "/api/v1/assistant/uses/nope.use/chain", map[string]any{"targets": []any{}}),
		http.StatusNotFound, "use_not_found", "")
	h.ExpectProblem(h.Do(http.MethodPut, path, map[string]any{"targets": []any{target("x", "speech")}}),
		http.StatusBadRequest, "invalid_request", "")

	var set useView
	h.MustDo(http.MethodPut, path, map[string]any{"targets": []any{target("llama", "tools"), target("qwen", "tools", "structured_output")}}, http.StatusOK, &set)
	if set.Default || !equal(set.chain(), []string{"Box/llama/provider_terms", "Box/qwen/provider_terms"}) {
		t.Fatalf("set chain = %+v", set)
	}
	h.MustDo(http.MethodPut, path, map[string]any{"targets": []any{}}, http.StatusOK, &set)
	if !set.Default || !equal(set.chain(), []string{"aistudio/gemini-3.5-flash-lite/trains", "aistudio/gemini-3.1-flash-lite/trains", "aistudio/gemini-3.5-flash/trains"}) {
		t.Fatalf("restored chain = %+v", set)
	}

	h.MustDo(http.MethodPut, path, map[string]any{"targets": []any{target("llama", "tools")}}, http.StatusOK, &set)
	h.MustDo(http.MethodDelete, "/api/v1/assistant/providers/"+p.ID, nil, http.StatusNoContent, nil)
	if chat := uses(t, h)["assistant.chat"]; !chat.Default || !equal(chat.chain(), []string{"aistudio/gemini-3.5-flash-lite/trains", "aistudio/gemini-3.1-flash-lite/trains", "aistudio/gemini-3.5-flash/trains"}) {
		t.Fatalf("chain after delete = %+v", chat)
	}
}

func structured(text string) llmtest.Step {
	return llmtest.Step{Response: llm.Response{
		Message: llm.Message{Role: llm.RoleModel, Parts: []llm.Part{{Text: text}}}, FinishReason: llm.FinishStop,
	}}
}

// A7: a use's call reaches the user's provider and moves to the next target on quota.
func TestUserChainCallA7(t *testing.T) {
	t.Parallel()
	f := newFakes()
	h := harness(t, f)
	p := createProvider(t, h, h.Client, map[string]any{"preset": "groq", "name": "Groq", "key": "ka"})
	first := llmtest.Step{Model: "m1", Err: &llm.QuotaError{}}
	second := structured(`{"items":[]}`)
	second.Model = "m2"
	provider := f.script("ka", first, second)
	h.MustDo(http.MethodPut, "/api/v1/assistant/uses/capture.suggest/chain", map[string]any{"targets": []any{
		map[string]any{"provider_id": p.ID, "model": "m1", "capabilities": []string{"structured_output"}},
		map[string]any{"provider_id": p.ID, "model": "m2", "capabilities": []string{"structured_output"}},
	}}, http.StatusOK, nil)

	ctx := auth.WithUserID(t.Context(), h.OwnerID())
	resp, err := h.App.LLM.Use(capture.SuggestUse).Generate(ctx, llm.Request{
		Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{{Text: "x"}}}}, Schema: []byte(`{"type":"object"}`),
	})
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if resp.Target != (llm.Target{Provider: p.ID, Model: "m2"}) || len(provider.Requests()) != 2 {
		t.Fatalf("target = %v, calls = %d", resp.Target, len(provider.Requests()))
	}
}

// A8: a quota error on one user's provider leaves another user's provider of the same preset
// and model available.
func TestCooldownPerUserA8(t *testing.T) {
	t.Parallel()
	f := newFakes()
	h := apitest.New(t, apitest.SecretKeys(apitest.SecretKey, ""), apitest.LLMFactory(f.build))
	other := h.Login("other@example.com")
	createProvider(t, h, h.Client, map[string]any{"preset": "groq", "name": "Groq", "key": "ka"})
	createProvider(t, h, other, map[string]any{"preset": "groq", "name": "Groq", "key": "kb"})
	f.script("ka", llmtest.Step{Model: "openai/gpt-oss-120b", Err: &llm.QuotaError{}})
	answer := structured("ok")
	answer.Model = "openai/gpt-oss-120b"
	f.script("kb", answer)

	var otherID int64
	if err := h.Pool.QueryRow(t.Context(), `SELECT id FROM identity_user WHERE email = 'other@example.com'`).Scan(&otherID); err != nil {
		t.Fatal(err)
	}
	req := llm.Request{Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{{Text: "x"}}}}}
	client := h.App.LLM.Use(assistant.ChatUse)
	if _, err := client.Generate(auth.WithUserID(t.Context(), h.OwnerID()), req); !errors.Is(err, llm.ErrExhausted) {
		t.Fatalf("owner err = %v, want ErrExhausted", err)
	}
	if resp, err := client.Generate(auth.WithUserID(t.Context(), otherID), req); err != nil || resp.Text() != "ok" {
		t.Fatalf("other user = %+v, %v", resp, err)
	}
}
