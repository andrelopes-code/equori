package reporting_test

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

type exportView struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Size   int64  `json:"size"`
	// ArchiveVersion is the archive_version of a ready export (ADR 021).
	ArchiveVersion int    `json:"archive_version"`
	SHA256         string `json:"sha256"`
	Problem        string `json:"problem"`
}

type manifest struct {
	Format         string `json:"format"`
	FormatVersion  int    `json:"format_version"`
	ArchiveVersion int    `json:"archive_version"`
	AppVersion     string `json:"app_version"`
	SchemaVersion  int64  `json:"schema_version"`
	Tables         []struct {
		Name   string `json:"name"`
		File   string `json:"file"`
		Rows   int    `json:"rows"`
		SHA256 string `json:"sha256"`
	} `json:"tables"`
	Attachments []struct {
		File   string `json:"file"`
		SHA256 string `json:"sha256"`
	} `json:"attachments"`
}

// archive reads every entry of a ZIP archive by name.
func archive(t *testing.T, body []byte) map[string][]byte {
	t.Helper()
	r, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		t.Fatalf("read archive: %v", err)
	}
	out := map[string][]byte{}
	for _, f := range r.File {
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

// export requests an export, dispatches its build and downloads the archive.
func export(t *testing.T, h *apitest.Harness) []byte {
	t.Helper()
	var requested exportView
	h.MustDo(http.MethodPost, "/api/v1/exports", nil, http.StatusAccepted, &requested)
	h.Dispatch()
	var done exportView
	h.MustDo(http.MethodGet, "/api/v1/exports/current", nil, http.StatusOK, &done)
	if done.Status != "ready" || done.ID != requested.ID || done.ArchiveVersion != app.ArchiveVersion {
		t.Fatalf("export = %+v, requested %+v", done, requested)
	}
	r := h.Do(http.MethodGet, "/api/v1/exports/current/content", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("content = %d: %s", r.Status, r.Body)
	}
	if got := r.Header.Get("Content-Type"); got != "application/zip" {
		t.Errorf("Content-Type = %q", got)
	}
	if got := r.Header.Get("Content-Disposition"); got != `attachment; filename="equori-export-2026-10-26.zip"` {
		t.Errorf("Content-Disposition = %q", got)
	}
	sum := sha256.Sum256(r.Body)
	if int64(len(r.Body)) != done.Size || hex.EncodeToString(sum[:]) != done.SHA256 {
		t.Errorf("size %d sha256 %s, export says %d %s", len(r.Body), hex.EncodeToString(sum[:]), done.Size, done.SHA256)
	}
	return r.Body
}

// SC6, spec 2026-10-26-export-design E1 to E3.
func TestExport(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-26"))
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/exports/current", nil), http.StatusNotFound, "not_found", "")
	checking := h.Account("Checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	tx := h.Record("2026-10-20", apitest.Posting(checking, -4590), apitest.Posting(food, 4590))
	// A correction keeps version 1 in ledger_transaction_version, which has no user_id.
	h.MustDo(http.MethodPut, "/api/v1/transactions/"+tx, map[string]any{
		"date": "2026-10-20", "description": "Groceries", "expected_version": 1, "reason": "typo",
		"postings": []map[string]any{apitest.Posting(checking, -4590), apitest.Posting(food, 4590)},
	}, http.StatusOK, nil)
	receipt := []byte("%PDF-1.4 receipt")
	if r := h.Upload("/api/v1/transactions/"+tx+"/attachments", "receipt.pdf", receipt); r.Status != http.StatusCreated {
		t.Fatalf("attachment = %d: %s", r.Status, r.Body)
	}

	h.MustDo(http.MethodPost, "/api/v1/exports", nil, http.StatusAccepted, nil)
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/exports", nil), http.StatusConflict, "export_pending", "")
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/exports/current/content", nil), http.StatusConflict, "export_not_ready", "")
	h.Dispatch()

	files := archive(t, export(t, h))
	var m manifest
	if err := json.Unmarshal(files["manifest.json"], &m); err != nil {
		t.Fatalf("manifest: %v", err)
	}
	// ADR 021, V1.
	if m.Format != "equori-export" || m.FormatVersion != 1 || m.ArchiveVersion != app.ArchiveVersion || m.AppVersion != "dev" || m.SchemaVersion == 0 {
		t.Fatalf("manifest = %+v", m)
	}
	rows := map[string]int{}
	for _, table := range m.Tables {
		rows[table.Name] = table.Rows
		sum := sha256.Sum256(files[table.File])
		if table.File != "tables/"+table.Name+".jsonl" || hex.EncodeToString(sum[:]) != table.SHA256 {
			t.Errorf("table %+v: file sha256 %x", table, sum)
		}
		if n := strings.Count(string(files[table.File]), "\n"); n != table.Rows {
			t.Errorf("%s: %d lines, manifest %d", table.Name, n, table.Rows)
		}
	}
	for _, name := range []string{"identity_user", "identity_session", "assistant_provider", "outbox_event", "reporting_account_day", "reporting_export", "capture_category_hint"} {
		if _, ok := rows[name]; ok {
			t.Errorf("%s is exported", name)
		}
	}
	if rows["ledger_transaction"] != 1 || rows["ledger_posting"] != 2 || rows["ledger_transaction_version"] != 1 || rows["ledger_attachment_blob"] != 1 {
		t.Errorf("rows = %v", rows)
	}
	if rows["marketdata_instrument"] == 0 {
		t.Error("shared instruments are missing")
	}
	if strings.Contains(string(files["tables/ledger_posting.jsonl"]), "user_id") {
		t.Error("a row carries user_id")
	}
	blob := files["tables/ledger_attachment_blob.jsonl"]
	if strings.Contains(string(blob), `"content"`) {
		t.Errorf("blob row carries its content: %s", blob)
	}
	sum := sha256.Sum256(receipt)
	if len(m.Attachments) != 1 || m.Attachments[0].File != "attachments/"+hex.EncodeToString(sum[:]) ||
		!bytes.Equal(files[m.Attachments[0].File], receipt) {
		t.Errorf("attachments = %+v", m.Attachments)
	}
}

// ADR 021, V1: a ready export built by a binary older than archive_version holds an archive
// without the field, which reads as version 1.
func TestExportBuiltBeforeArchiveVersion(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-26"))
	export(t, h)
	if _, err := h.Pool.Exec(t.Context(), `UPDATE reporting_export SET archive_version = NULL`); err != nil {
		t.Fatal(err)
	}
	var e exportView
	h.MustDo(http.MethodGet, "/api/v1/exports/current", nil, http.StatusOK, &e)
	if e.Status != "ready" || e.ArchiveVersion != 1 {
		t.Fatalf("export = %+v", e)
	}
}
