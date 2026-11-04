package ingestion_test

import (
	"archive/zip"
	"bytes"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const archivePassphrase = "correct horse battery"

// otherKey is the integration key of an instance that receives an archive.
var otherKey = strings.Repeat("n", 32)

// Export design C1 to C7: the credentials of an integration travel in the archive, sealed by a
// passphrase, and work on an instance with another key.
func TestCredentialsTravelInTheArchive(t *testing.T) {
	t.Parallel()
	source := newAggregator(t)
	source.serveItem(pluggyClient, nubankItem, "Nubank")
	in := source.integrate(source.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)

	archive := exportWith(t, source.h, map[string]any{"credentials_passphrase": archivePassphrase})
	files := unzipArchive(t, archive)

	if _, ok := files["credentials.enc"]; !ok {
		t.Fatal("the archive has no credentials.enc")
	}

	for name, b := range files {
		if bytes.Contains(b, []byte(pluggySecret)) || bytes.Contains(b, []byte(pluggyClient)) {
			t.Errorf("%s holds a credential in the clear", name)
		}
	}

	if strings.Contains(string(archive), pluggySecret) {
		t.Error("the archive holds a credential in the clear")
	}

	var kept int
	if err := source.h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM reporting_export WHERE credentials IS NOT NULL`).Scan(&kept); err != nil || kept != 0 {
		t.Fatalf("bundles kept after the build = %d, %v; want 0", kept, err)
	}

	target := newAggregator(t, apitest.SecretKeys(otherKey, ""))
	target.serveItem(pluggyClient, nubankItem, "Nubank")

	var res importResult
	r := target.h.UploadWith("/api/v1/imports/archive", map[string]string{"passphrase": archivePassphrase}, "export.zip", archive)
	if r.Status != http.StatusOK {
		t.Fatalf("import = %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &res)

	if !res.CredentialsInArchive || res.CredentialsRestored != 1 {
		t.Fatalf("result = %+v, want the credential restored", res)
	}

	target.mustConnect(target.h.Client, in.ID, nubankItem)
}

func TestImportWithoutThePassphraseLeavesTheCredentialsOut(t *testing.T) {
	t.Parallel()
	source := newAggregator(t)
	source.serveItem(pluggyClient, nubankItem, "Nubank")
	in := source.integrate(source.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	archive := exportWith(t, source.h, map[string]any{"credentials_passphrase": archivePassphrase})

	target := newAggregator(t)
	target.serveItem(pluggyClient, nubankItem, "Nubank")

	r := target.h.Upload("/api/v1/imports/archive", "export.zip", archive)
	if r.Status != http.StatusOK {
		t.Fatalf("import = %d: %s", r.Status, r.Body)
	}

	var res importResult
	r.Decode(t, &res)

	if !res.CredentialsInArchive || res.CredentialsRestored != 0 {
		t.Fatalf("result = %+v, want the credentials in the archive and none restored", res)
	}

	target.h.ExpectProblem(target.connect(target.h.Client, in.ID, nubankItem), http.StatusConflict, "integration_unavailable", "")
}

func TestImportRejectsAWrongPassphraseWithoutWriting(t *testing.T) {
	t.Parallel()
	source := newAggregator(t)
	source.integrate(source.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	archive := exportWith(t, source.h, map[string]any{"credentials_passphrase": archivePassphrase})

	target := newAggregator(t)
	target.h.ExpectProblem(
		target.h.UploadWith("/api/v1/imports/archive", map[string]string{"passphrase": "wrong horse battery"}, "export.zip", archive),
		http.StatusUnprocessableEntity, "passphrase_invalid", "passphrase")

	var integrations int
	if err := target.h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM ingestion_integration`).Scan(&integrations); err != nil || integrations != 0 {
		t.Fatalf("integrations after a refused import = %d, %v; want 0", integrations, err)
	}
}

func TestImportWithAPassphraseNeedsTheInstanceKey(t *testing.T) {
	t.Parallel()
	source := newAggregator(t)
	source.integrate(source.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	archive := exportWith(t, source.h, map[string]any{"credentials_passphrase": archivePassphrase})

	keyless := apitest.New(t)
	keyless.ExpectProblem(
		keyless.UploadWith("/api/v1/imports/archive", map[string]string{"passphrase": archivePassphrase}, "export.zip", archive),
		http.StatusConflict, "integration_unavailable", "")

	var accounts int
	if err := keyless.Pool.QueryRow(t.Context(), `SELECT count(*) FROM ledger_account`).Scan(&accounts); err != nil || accounts == 0 {
		t.Fatalf("accounts = %d, %v; the sign-up accounts must stay", accounts, err)
	}
}

func TestExportWithAPassphraseValidates(t *testing.T) {
	t.Parallel()
	keyless := apitest.New(t)
	keyless.ExpectProblem(
		keyless.Do(http.MethodPost, "/api/v1/exports", map[string]any{"credentials_passphrase": archivePassphrase}),
		http.StatusConflict, "integration_unavailable", "")

	a := newAggregator(t)
	a.h.ExpectProblem(
		a.h.Do(http.MethodPost, "/api/v1/exports", map[string]any{"credentials_passphrase": "short"}),
		http.StatusBadRequest, "invalid_request", "credentials_passphrase")
	a.h.ExpectProblem(
		a.h.Do(http.MethodPost, "/api/v1/exports", map[string]any{"credentials_passphrase": strings.Repeat("x", 257)}),
		http.StatusBadRequest, "invalid_request", "credentials_passphrase")

	// A book with no stored credential builds an archive without the entry.
	archive := exportWith(t, a.h, map[string]any{"credentials_passphrase": archivePassphrase})
	if _, ok := unzipArchive(t, archive)["credentials.enc"]; ok {
		t.Fatal("an archive of a book without credentials has credentials.enc")
	}
}

type importResult struct {
	CredentialsInArchive bool `json:"credentials_in_archive"`
	CredentialsRestored  int  `json:"credentials_restored"`
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

func TestOnlyAnOwnerExportsCredentials(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)

	reader := a.h.JoinAs("reader@example.com", a.h.OwnerID(), "read")
	a.h.ExpectProblem(
		a.h.Call(reader, http.MethodPost, "/api/v1/exports", map[string]any{"credentials_passphrase": archivePassphrase}),
		http.StatusForbidden, "book_role_required", "")

	if r := a.h.Call(reader, http.MethodPost, "/api/v1/exports", nil); r.Status != http.StatusAccepted {
		t.Fatalf("a read member's export without credentials = %d: %s", r.Status, r.Body)
	}
}
