package assistant_test

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
	"github.com/andrelopes-code/equori/internal/platform/secret"
)

// fakes hands the module one scripted provider per key, so a test reaches the provider a
// user configured.
type fakes struct {
	mu     sync.Mutex
	byKey  map[string]*fake
	models []string
	err    error
}

type fake struct {
	*llmtest.Provider
	models []string
	err    error
}

func (f *fake) Models(context.Context) ([]string, error) { return f.models, f.err }

func newFakes() *fakes { return &fakes{byKey: map[string]*fake{}} }

func (f *fakes) script(key string, steps ...llmtest.Step) *llmtest.Provider {
	f.mu.Lock()
	defer f.mu.Unlock()
	p := llmtest.New("openai", steps...)
	f.byKey[key] = &fake{Provider: p}
	return p
}

func (f *fakes) build(_, _, key string) llm.Provider {
	f.mu.Lock()
	defer f.mu.Unlock()
	if p, ok := f.byKey[key]; ok {
		return p
	}
	return &fake{Provider: llmtest.New("openai"), models: f.models, err: f.err}
}

type providerView struct {
	ID       string `json:"id"`
	Preset   string `json:"preset"`
	Name     string `json:"name"`
	BaseURL  string `json:"base_url"`
	HasKey   bool   `json:"has_key"`
	Notice   string `json:"notice"`
	Instance bool   `json:"instance"`
}

func harness(t *testing.T, f *fakes, opts ...apitest.Option) *apitest.Harness {
	t.Helper()
	return apitest.New(t, append([]apitest.Option{
		apitest.SecretKeys(apitest.SecretKey, ""), apitest.LLMFactory(f.build), apitest.LLM(llmtest.New("aistudio")),
	}, opts...)...)
}

func createProvider(t *testing.T, h *apitest.Harness, c *http.Client, body map[string]any) providerView {
	t.Helper()
	r := h.Call(c, http.MethodPost, "/api/v1/assistant/providers", body)
	if r.Status != http.StatusCreated {
		t.Fatalf("create provider = %d: %s", r.Status, r.Body)
	}
	var v providerView
	r.Decode(t, &v)
	return v
}

// A1: a provider from each preset; the key is sealed to its row and never returned.
func TestCreateProviderA1(t *testing.T) {
	t.Parallel()
	h := harness(t, newFakes())
	keys := map[string]string{"gemini": "k1", "groq": "k2", "openrouter": "k3", "mistral": "k4", "ollama": "", "lmstudio": "", "custom": ""}
	for preset, key := range keys {
		body := map[string]any{"preset": preset, "name": "P " + preset}
		if key != "" {
			body["key"] = "secret-" + key
		}
		if preset == "custom" {
			body["base_url"] = "https://llm.example.com/v1/"
		}
		r := h.Do(http.MethodPost, "/api/v1/assistant/providers", body)
		if r.Status != http.StatusCreated || strings.Contains(string(r.Body), "secret-") {
			t.Fatalf("create %s = %d: %s", preset, r.Status, r.Body)
		}
		var v providerView
		r.Decode(t, &v)
		if v.Preset != preset || v.HasKey != (key != "") || v.Instance {
			t.Fatalf("created %s = %+v", preset, v)
		}
		if preset == "custom" && v.BaseURL != "https://llm.example.com/v1" {
			t.Fatalf("custom base URL = %s", v.BaseURL)
		}
	}

	var list struct {
		Items []providerView `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/assistant/providers", nil, http.StatusOK, &list)
	last := list.Items[len(list.Items)-1]
	if len(list.Items) != len(keys)+1 || last != (providerView{ID: "aistudio", Preset: "gemini", Name: "aistudio", HasKey: true, Notice: "trains", Instance: true}) {
		t.Fatalf("providers = %+v", list.Items)
	}

	var id string
	var sealed []byte
	if err := h.Pool.QueryRow(t.Context(), `SELECT id, sealed_key FROM assistant_provider WHERE preset = 'groq'`).Scan(&id, &sealed); err != nil {
		t.Fatal(err)
	}
	box, err := secret.New([]byte(apitest.SecretKey), nil)
	if err != nil {
		t.Fatal(err)
	}
	plain, err := box.Open(sealed, fmt.Appendf(nil, "assistant_provider|%d|%s", h.OwnerID(), id))
	if err != nil || string(plain) != "secret-k2" {
		t.Fatalf("sealed key opens to %q, %v", plain, err)
	}
}

// A2, A3: key rules and the secret key.
func TestProviderKeysA2A3(t *testing.T) {
	t.Parallel()
	h := harness(t, newFakes())
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/assistant/providers", map[string]any{"preset": "groq", "name": "Groq"}),
		http.StatusUnprocessableEntity, "key_required", "key")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/assistant/providers", map[string]any{"preset": "custom", "name": "X", "base_url": "ftp://h"}),
		http.StatusUnprocessableEntity, "validation_failed", "base_url")

	bare := apitest.New(t)
	bare.ExpectProblem(bare.Do(http.MethodPost, "/api/v1/assistant/providers", map[string]any{"preset": "groq", "name": "Groq", "key": "k"}),
		http.StatusConflict, "secret_key_missing", "")
	createProvider(t, bare, bare.Client, map[string]any{"preset": "ollama", "name": "Local"})
}

// Review focus: an absent key keeps the stored one; an empty key on a preset that requires
// one is refused.
func TestUpdateProvider(t *testing.T) {
	t.Parallel()
	h := harness(t, newFakes())
	p := createProvider(t, h, h.Client, map[string]any{"preset": "groq", "name": "Groq", "key": "k"})
	path := "/api/v1/assistant/providers/" + p.ID
	var v providerView
	h.MustDo(http.MethodPatch, path, map[string]any{"name": "Groq free"}, http.StatusOK, &v)
	if v.Name != "Groq free" || !v.HasKey {
		t.Fatalf("renamed = %+v", v)
	}
	h.ExpectProblem(h.Do(http.MethodPatch, path, map[string]any{"key": ""}), http.StatusUnprocessableEntity, "key_required", "key")
	h.MustDo(http.MethodPatch, path, map[string]any{"base_url": "https://proxy.example.com/v1"}, http.StatusOK, &v)
	if v.BaseURL != "https://proxy.example.com/v1" || !v.HasKey {
		t.Fatalf("moved = %+v", v)
	}
	h.ExpectProblem(h.Do(http.MethodPatch, path, map[string]any{"name": " "}), http.StatusUnprocessableEntity, "validation_failed", "name")
}

// A4: another user reaches none of the owner's providers.
func TestProviderIsolationA4(t *testing.T) {
	t.Parallel()
	h := harness(t, newFakes())
	p := createProvider(t, h, h.Client, map[string]any{"preset": "ollama", "name": "Local"})
	other := h.Login("other@example.com")
	path := "/api/v1/assistant/providers/" + p.ID
	for _, r := range []apitest.Response{
		h.Call(other, http.MethodPatch, path, map[string]any{"name": "Mine"}),
		h.Call(other, http.MethodDelete, path, nil),
		h.Call(other, http.MethodGet, path+"/models", nil),
		h.Call(other, http.MethodPut, "/api/v1/assistant/uses/assistant.chat/chain",
			map[string]any{"targets": []any{map[string]any{"provider_id": p.ID, "model": "qwen3:32b"}}}),
	} {
		h.ExpectProblem(r, http.StatusNotFound, "provider_not_found", "")
	}
	var list struct {
		Items []providerView `json:"items"`
	}
	if r := h.Call(other, http.MethodGet, "/api/v1/assistant/providers", nil); r.Status != http.StatusOK {
		t.Fatalf("list = %d", r.Status)
	} else if r.Decode(t, &list); len(list.Items) != 1 || !list.Items[0].Instance {
		t.Fatalf("other user's providers = %+v", list.Items)
	}
}

// A10: the model listing returns the IDs, and a rejected key is provider_unauthorized.
func TestProviderModelsA10(t *testing.T) {
	t.Parallel()
	f := newFakes()
	f.models = []string{"a", "b"}
	h := harness(t, f)
	p := createProvider(t, h, h.Client, map[string]any{"preset": "groq", "name": "Groq", "key": "k"})
	var out struct {
		Items []string `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/assistant/providers/"+p.ID+"/models", nil, http.StatusOK, &out)
	if strings.Join(out.Items, ",") != "a,b" {
		t.Fatalf("models = %v", out.Items)
	}

	f.err = fmt.Errorf("status 401: %w", llm.ErrUnauthorized)
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/assistant/providers/"+p.ID+"/models", nil), http.StatusBadGateway, "provider_unauthorized", "")
	f.err = fmt.Errorf("status 503: %w", llm.ErrTransient)
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/assistant/providers/"+p.ID+"/models", nil), http.StatusBadGateway, "provider_unavailable", "")
}
