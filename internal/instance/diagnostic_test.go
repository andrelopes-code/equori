package instance_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const diagnosticPath = "/api/v1/instance/diagnostic"

type diagnosticFile struct {
	Tables []struct {
		Name string `json:"name"`
	} `json:"tables"`
	Backup struct {
		Backups struct {
			State string `json:"state"`
		} `json:"backups"`
	} `json:"backup"`
	Log []struct {
		Message string            `json:"message"`
		Attrs   map[string]string `json:"attrs"`
	} `json:"log"`
}

// S219: the diagnostic file holds no amount, name or description.
func TestS219DiagnosticHoldsNoBookData(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-11-20"), apitest.Backups(t.TempDir(), "", apitest.FakeDump))
	zebra := h.Account("Zebra Checking 7731", "asset", "checking", nil)
	quokka := h.Account("Quokka Bakery 5520", "expense", "", nil)

	h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
		"date":        "2026-11-10",
		"description": "Narwhal Pastry 3309",
		"postings":    []map[string]any{apitest.Posting(zebra, -98765), apitest.Posting(quokka, 98765)},
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodPost, backupPath, nil, http.StatusOK, nil)

	h.Logger().Warn("sync failed", "error", "Narwhal Pastry 3309 98765", "code", "aggregator_timeout", "route", "/api/v1/x")

	r := h.Do(http.MethodGet, diagnosticPath, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", r.Status, r.Body)
	}

	wantHeader := `attachment; filename="equori-diagnostic-2026-11-20.json"`
	if got := r.Header.Get("Content-Disposition"); got != wantHeader {
		t.Fatalf("Content-Disposition = %q, want %q", got, wantHeader)
	}

	for _, s := range []string{"Zebra", "Quokka", "Narwhal", "98765", "987.65", "987,65"} {
		if strings.Contains(string(r.Body), s) {
			t.Errorf("diagnostic file contains %q: %s", s, r.Body)
		}
	}

	var got diagnosticFile
	r.Decode(t, &got)

	if len(got.Log) != 1 || got.Log[0].Message != "sync failed" || len(got.Log[0].Attrs) != 2 ||
		got.Log[0].Attrs["code"] != "aggregator_timeout" || got.Log[0].Attrs["route"] != "/api/v1/x" {
		t.Fatalf("log = %+v, want one record sync failed with code and route", got.Log)
	}

	if !hasTable(got, "ledger_posting") {
		t.Errorf("tables = %+v, want ledger_posting", got.Tables)
	}

	if got.Backup.Backups.State != "on" {
		t.Errorf("backup state = %q, want on", got.Backup.Backups.State)
	}

	var keys map[string]any
	r.Decode(t, &keys)

	if len(keys) != 14 {
		t.Errorf("top-level keys = %d, want 14: %v", len(keys), keys)
	}
}

func hasTable(d diagnosticFile, name string) bool {
	for _, tbl := range d.Tables {
		if tbl.Name == name {
			return true
		}
	}

	return false
}
