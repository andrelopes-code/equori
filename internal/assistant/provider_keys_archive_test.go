package assistant_test

import (
	"archive/zip"
	"bytes"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/llm"
)

const (
	archivePassphrase = "correct horse battery"
	groqModel         = "openai/gpt-oss-120b"
)

// otherKey is the secret key of an instance that receives an archive.
var otherKey = strings.Repeat("n", 32)

const importURL = "/api/v1/imports/archive"

type keysImport struct {
	CredentialsInArchive bool `json:"credentials_in_archive"`
	ProviderKeysRestored int  `json:"provider_keys_restored"`
}

// Export design T3 to T7: a provider key travels in the archive, sealed by the passphrase, and
// works on an instance with another secret key.
func TestProviderKeysTravelInTheArchive(t *testing.T) {
	t.Parallel()

	source := harness(t, newFakes(), apitest.Today("2026-10-26"))
	p := createProvider(t, source, source.Client, map[string]any{"preset": "groq", "name": "Groq", "key": "gsk-secret"})
	setChain(t, source, p.ID)

	archive := exportWith(t, source, map[string]any{"credentials_passphrase": archivePassphrase})
	files := unzipArchive(t, archive)

	if _, ok := files["credentials.enc"]; !ok {
		t.Fatal("the archive has no credentials.enc")
	}

	for name, b := range files {
		if bytes.Contains(b, []byte("gsk-secret")) {
			t.Errorf("%s holds the key in the clear", name)
		}
	}

	answer := structured("restored")
	answer.Model = groqModel

	f := newFakes()
	f.script("gsk-secret", answer)

	target := harness(t, f, apitest.Today("2026-10-26"), apitest.SecretKeys(otherKey, ""))

	r := target.UploadWith(importURL, map[string]string{"passphrase": archivePassphrase}, "export.zip", archive)
	if r.Status != http.StatusOK {
		t.Fatalf("import = %d: %s", r.Status, r.Body)
	}

	var res keysImport
	r.Decode(t, &res)

	if !res.CredentialsInArchive || res.ProviderKeysRestored != 1 {
		t.Fatalf("result = %+v, want the key restored", res)
	}

	if got := ownProviders(t, target); len(got) != 1 || got[0].Name != "Groq" || !got[0].HasKey {
		t.Fatalf("providers = %+v, want Groq with its key", got)
	}

	ctx := auth.WithBooksID(t.Context(), target.OwnerID())
	req := llm.Request{Messages: []llm.Message{{Role: llm.RoleUser, Parts: []llm.Part{{Text: "x"}}}}}

	resp, err := target.App.LLM.Use(assistant.ChatUse).Generate(ctx, req)
	if err != nil || resp.Message.Parts[0].Text != "restored" {
		t.Fatalf("generate = %+v, %v; want the answer scripted for the restored key", resp, err)
	}
}

// Export design T6: the entry is refused without its passphrase, opens only with the right one,
// and a skipped import keeps the chain and the limit.
func TestProviderKeysSkippedOrRefused(t *testing.T) {
	t.Parallel()

	source := harness(t, newFakes(), apitest.Today("2026-10-26"))
	p := createProvider(t, source, source.Client, map[string]any{"preset": "groq", "name": "Groq", "key": "gsk-secret"})
	setChain(t, source, p.ID)
	source.MustDo(http.MethodPut, "/api/v1/assistant/usage/limits", map[string]any{
		"provider_id": p.ID, "model": groqModel, "requests_per_day": 50,
	}, http.StatusNoContent, nil)

	archive := exportWith(t, source, map[string]any{"credentials_passphrase": archivePassphrase})

	target := harness(t, newFakes(), apitest.Today("2026-10-26"), apitest.SecretKeys(otherKey, ""))
	target.ExpectProblem(target.Upload(importURL, "export.zip", archive), http.StatusUnprocessableEntity, "passphrase_required", "passphrase")
	target.ExpectProblem(
		target.UploadWith(importURL, map[string]string{"passphrase": "wrong horse battery"}, "export.zip", archive),
		http.StatusUnprocessableEntity, "passphrase_invalid", "passphrase")

	if n := countRows(t, target, "assistant_provider"); n != 0 {
		t.Fatalf("providers after the refusals = %d, want 0", n)
	}

	r := target.UploadWith(importURL, map[string]string{"skip_credentials": "true"}, "export.zip", archive)
	if r.Status != http.StatusOK {
		t.Fatalf("import = %d: %s", r.Status, r.Body)
	}

	var res keysImport
	r.Decode(t, &res)

	if !res.CredentialsInArchive || res.ProviderKeysRestored != 0 {
		t.Fatalf("result = %+v, want the entry present and no key restored", res)
	}

	if got := ownProviders(t, target); len(got) != 1 || got[0].HasKey {
		t.Fatalf("providers = %+v, want Groq without its key", got)
	}

	if countRows(t, target, "assistant_chain_target") != 1 || countRows(t, target, "assistant_usage_limit") != 1 {
		t.Fatal("the chain target or the limit is missing after the skipped import")
	}
}

// A provider with no key has nothing to seal: the archive has no credentials entry and the import
// needs no passphrase.
func TestProviderWithoutKeyExports(t *testing.T) {
	t.Parallel()

	source := harness(t, newFakes(), apitest.Today("2026-10-26"))
	createProvider(t, source, source.Client, map[string]any{"preset": "ollama", "name": "Local"})

	archive := exportWith(t, source, map[string]any{"credentials_passphrase": archivePassphrase})
	if _, ok := unzipArchive(t, archive)["credentials.enc"]; ok {
		t.Fatal("an archive of keyless providers has credentials.enc")
	}

	target := harness(t, newFakes(), apitest.Today("2026-10-26"), apitest.SecretKeys(otherKey, ""))
	if r := target.Upload(importURL, "export.zip", archive); r.Status != http.StatusOK {
		t.Fatalf("import = %d: %s", r.Status, r.Body)
	}

	if got := ownProviders(t, target); len(got) != 1 || got[0].Name != "Local" || got[0].HasKey {
		t.Fatalf("providers = %+v, want Local without a key", got)
	}
}

// Export design T3: a key that does not open under the instance key is left out and the export
// still succeeds.
func TestUnreadableProviderKeyIsLeftOut(t *testing.T) {
	t.Parallel()

	source := harness(t, newFakes(), apitest.Today("2026-10-26"))
	createProvider(t, source, source.Client, map[string]any{"preset": "groq", "name": "Groq", "key": "gsk-good"})
	bad := createProvider(t, source, source.Client, map[string]any{"preset": "mistral", "name": "Mistral", "key": "ms-bad"})

	if _, err := source.Pool.Exec(t.Context(), `UPDATE assistant_provider SET sealed_key = decode(repeat('ab', 64), 'hex') WHERE id = $1`, bad.ID); err != nil {
		t.Fatal(err)
	}

	archive := exportWith(t, source, map[string]any{"credentials_passphrase": archivePassphrase})

	target := harness(t, newFakes(), apitest.Today("2026-10-26"), apitest.SecretKeys(otherKey, ""))

	r := target.UploadWith(importURL, map[string]string{"passphrase": archivePassphrase}, "export.zip", archive)
	if r.Status != http.StatusOK {
		t.Fatalf("import = %d: %s", r.Status, r.Body)
	}

	var res keysImport
	r.Decode(t, &res)

	if res.ProviderKeysRestored != 1 {
		t.Fatalf("restored = %d, want only the readable key", res.ProviderKeysRestored)
	}
}

func setChain(t *testing.T, h *apitest.Harness, providerID string) {
	t.Helper()
	h.MustDo(http.MethodPut, "/api/v1/assistant/uses/assistant.chat/chain", map[string]any{"targets": []any{
		map[string]any{"provider_id": providerID, "model": groqModel, "capabilities": []string{"tools"}},
	}}, http.StatusOK, nil)
}

func ownProviders(t *testing.T, h *apitest.Harness) []providerView {
	t.Helper()

	var list struct {
		Items []providerView `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/assistant/providers", nil, http.StatusOK, &list)

	var own []providerView

	for _, p := range list.Items {
		if !p.Instance {
			own = append(own, p)
		}
	}

	return own
}

func countRows(t *testing.T, h *apitest.Harness, table string) int {
	t.Helper()

	var n int
	if err := h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM `+table).Scan(&n); err != nil {
		t.Fatal(err)
	}

	return n
}

// exportWith requests an export with body, dispatches its build and downloads the archive.
func exportWith(t *testing.T, h *apitest.Harness, body any) []byte {
	t.Helper()
	h.MustDo(http.MethodPost, "/api/v1/exports", body, http.StatusAccepted, nil)
	h.Dispatch()

	r := h.Do(http.MethodGet, "/api/v1/exports/current/content", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("content = %d: %s", r.Status, r.Body)
	}

	return r.Body
}

func unzipArchive(t *testing.T, body []byte) map[string][]byte {
	t.Helper()

	z, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		t.Fatal(err)
	}

	out := map[string][]byte{}

	for _, f := range z.File {
		rc, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}

		b, err := io.ReadAll(rc)
		rc.Close()

		if err != nil {
			t.Fatal(err)
		}

		out[f.Name] = b
	}

	return out
}
