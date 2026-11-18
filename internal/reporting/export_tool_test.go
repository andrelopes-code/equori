package reporting_test

import (
	"encoding/json"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type toolExport struct {
	Status       string `json:"status"`
	Size         int64  `json:"size"`
	DownloadPath string `json:"download_path"`
}

func exportTool(t *testing.T, h *apitest.Harness, name string) toolExport {
	t.Helper()

	r := h.Tool(name, map[string]any{})
	if r.IsError {
		t.Fatalf("%s = %s", name, r.Content)
	}

	var out toolExport
	if err := json.Unmarshal(r.Content, &out); err != nil {
		t.Fatal(err)
	}

	return out
}

// TestExportTools requests an export through the tool, refuses a second one while the
// first is pending and reads the download path once the archive is ready.
func TestExportTools(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-26"))

	h.ExpectToolError(h.Tool("get_export", map[string]any{}), "not_found", "")

	if got := exportTool(
		t,
		h,
		"request_export",
	); got.Status != "pending" ||
		got.DownloadPath != "" {
		t.Fatalf("requested = %+v", got)
	}

	h.ExpectToolError(h.Tool("request_export", map[string]any{}), "export_pending", "")
	h.Dispatch()

	got := exportTool(t, h, "get_export")
	if got.Status != "ready" || got.Size == 0 ||
		got.DownloadPath != "/api/v1/exports/current/content" {
		t.Fatalf("ready = %+v", got)
	}
}
