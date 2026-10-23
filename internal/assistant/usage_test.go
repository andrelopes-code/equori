package assistant_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/capture"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

type usageView struct {
	ProviderID     string     `json:"provider_id"`
	ProviderName   string     `json:"provider_name"`
	Instance       bool       `json:"instance"`
	Model          string     `json:"model"`
	TodayRequests  int64      `json:"today_requests"`
	TodayErrors    int64      `json:"today_errors"`
	TodayTokens    int64      `json:"today_tokens"`
	PeriodRequests int64      `json:"period_requests"`
	PeriodTokens   int64      `json:"period_tokens"`
	PeriodDays     int        `json:"period_days"`
	RequestsPerDay *int64     `json:"requests_per_day"`
	TokensPerDay   *int64     `json:"tokens_per_day"`
	CoolingUntil   *time.Time `json:"cooling_until"`
}

func usage(t *testing.T, h *apitest.Harness) []usageView {
	t.Helper()
	var out struct {
		Items []usageView `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/assistant/usage", nil, http.StatusOK, &out)
	return out.Items
}

func call(ctx context.Context, h *apitest.Harness, use llm.Use) error {
	_, err := h.App.LLM.Use(use).Generate(ctx, llm.Request{
		Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{{Text: "x"}}}}, Schema: []byte(`{"type":"object"}`),
	})
	return err
}

// U-A1, U-A3: an answered call and a quota refusal give one row with both, the tokens and the
// cooldown end; another user's usage never appears.
func TestUsageA1A3(t *testing.T) {
	t.Parallel()
	ok := structured(`{"items":[]}`)
	ok.Model = "gemini-3.5-flash-lite"
	ok.Response.Usage = llm.Usage{InputTokens: 40, OutputTokens: 2}
	quota := llmtest.Step{Model: "gemini-3.5-flash-lite", Err: &llm.QuotaError{RetryAfter: time.Hour}}
	h := apitest.New(t, apitest.LLM(llmtest.New("aistudio", ok, quota)))
	ctx := auth.WithUserID(t.Context(), h.OwnerID())
	if err := call(ctx, h, capture.SuggestUse); err != nil {
		t.Fatalf("first call: %v", err)
	}
	if err := call(ctx, h, capture.SuggestUse); err == nil {
		t.Fatal("second call answered; want a quota refusal")
	}
	got := usage(t, h)
	if len(got) != 1 {
		t.Fatalf("usage = %+v", got)
	}
	u := got[0]
	if u.ProviderID != "aistudio" || !u.Instance || u.Model != "gemini-3.5-flash-lite" || u.TodayRequests != 2 ||
		u.TodayErrors != 1 || u.TodayTokens != 42 || u.PeriodRequests != 2 || u.PeriodTokens != 42 || u.PeriodDays != 30 ||
		u.CoolingUntil == nil || u.RequestsPerDay != nil {
		t.Fatalf("usage row = %+v", u)
	}

	other := h.Login("other@example.com")
	var list struct {
		Items []usageView `json:"items"`
	}
	r := h.Call(other, http.MethodGet, "/api/v1/assistant/usage", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("other user's usage = %d", r.Status)
	}
	if r.Decode(t, &list); len(list.Items) != 0 {
		t.Fatalf("other user sees %+v", list.Items)
	}
}

// U-A2: a call without a user and a fixed-chain call record nothing.
func TestUsageWithoutUseOrUserA2(t *testing.T) {
	t.Parallel()
	answer := structured(`{}`)
	answer.Model = "gemini-3.5-flash-lite"
	fixed := answer
	fixed.Model = "gemini-3.5-flash"
	h := apitest.New(t, apitest.LLM(llmtest.New("aistudio", answer, fixed)))
	if err := call(t.Context(), h, assistant.ChatUse); err != nil {
		t.Fatalf("call without a user: %v", err)
	}
	ctx := auth.WithUserID(t.Context(), h.OwnerID())
	if _, err := h.App.LLM.Client(llm.Target{Provider: "aistudio", Model: "gemini-3.5-flash"}).Generate(ctx, llm.Request{
		Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{{Text: "x"}}}},
	}); err != nil {
		t.Fatalf("fixed chain: %v", err)
	}
	if got := usage(t, h); len(got) != 0 {
		t.Fatalf("usage = %+v", got)
	}
}

// U-A4, U-A5: limits on the instance provider and on the user's own; another user's provider
// is not found; deleting a provider removes its usage and limits.
func TestUsageLimitsA4A5(t *testing.T) {
	t.Parallel()
	h := harness(t, newFakes())
	p := createProvider(t, h, h.Client, map[string]any{"preset": "ollama", "name": "Local"})
	path := "/api/v1/assistant/usage/limits"
	h.MustDo(http.MethodPut, path, map[string]any{"provider_id": "aistudio", "model": "gemini-3.5-flash", "requests_per_day": 250}, http.StatusNoContent, nil)
	h.MustDo(http.MethodPut, path, map[string]any{"provider_id": p.ID, "model": "qwen3:32b", "tokens_per_day": 100000}, http.StatusNoContent, nil)
	h.ExpectProblem(h.Do(http.MethodPut, path, map[string]any{"provider_id": "aistudio", "model": "m", "requests_per_day": 0}),
		http.StatusBadRequest, "invalid_request", "")
	other := h.Login("other@example.com")
	h.ExpectProblem(h.Call(other, http.MethodPut, path, map[string]any{"provider_id": p.ID, "model": "m", "requests_per_day": 1}),
		http.StatusNotFound, "provider_not_found", "")
	h.ExpectProblem(h.Do(http.MethodPut, path, map[string]any{"provider_id": "nope", "model": "m", "requests_per_day": 1}),
		http.StatusNotFound, "provider_not_found", "")

	got := usage(t, h)
	if len(got) != 2 || got[0].ProviderID != p.ID || got[0].TokensPerDay == nil || *got[0].TokensPerDay != 100000 ||
		got[1].ProviderID != "aistudio" || got[1].RequestsPerDay == nil || *got[1].RequestsPerDay != 250 || got[1].TodayRequests != 0 {
		t.Fatalf("usage = %+v", got)
	}

	h.MustDo(http.MethodPut, path, map[string]any{"provider_id": "aistudio", "model": "gemini-3.5-flash"}, http.StatusNoContent, nil)
	h.MustDo(http.MethodDelete, "/api/v1/assistant/providers/"+p.ID, nil, http.StatusNoContent, nil)
	if got := usage(t, h); len(got) != 0 {
		t.Fatalf("usage after clearing and deleting = %+v", got)
	}
}
