package reporting_test

import (
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/reporting/app"
)

var update = flag.Bool(
	"update",
	false,
	"write the fixture archive of a new archive_version to testdata",
)

// ADR 021, V7: the fixture of every published archive_version imports on the current one.
func TestImportArchiveFixtures(t *testing.T) {
	t.Parallel()

	path := fmt.Sprintf("testdata/archive-v%d.zip", app.ArchiveVersion)
	if _, err := os.Stat(path); errors.Is(err, fs.ErrNotExist) && *update {
		source := apitest.New(t, apitest.Today("2026-10-26"))
		populate(t, source)

		if err := os.WriteFile(path, export(t, source), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	for v := 1; v <= app.ArchiveVersion; v++ {
		t.Run(fmt.Sprintf("v%d", v), func(t *testing.T) {
			t.Parallel()

			fixture, err := os.ReadFile(fmt.Sprintf("testdata/archive-v%d.zip", v))
			if err != nil {
				t.Fatalf("%v; run this test with -update once for a new archive_version", err)
			}

			h := apitest.New(t, apitest.Today("2026-10-26"))

			r := h.Upload(importPath, "a.zip", fixture)
			if r.Status != http.StatusOK {
				t.Fatalf("import = %d: %s", r.Status, r.Body)
			}

			expectFixture(t, h)
			expectProviders(t, h, v)
			expectSpreadsheets(t, h, v)
		})
	}
}

// expectFixture checks the books populate records, as read on the current version.
func expectFixture(t *testing.T, h *apitest.Harness) {
	t.Helper()
	var accounts struct {
		Items []struct {
			ID         string `json:"id"`
			Name       string `json:"name"`
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &accounts)

	ids := map[string]string{}
	for _, a := range accounts.Items {
		if a.SystemRole == "" {
			ids[a.Name] = a.ID
		}
	}

	names := []string{"Checking", "Food", "Rent", "Visa", "XP", "XP MXRF11", "XP cash"}
	if len(ids) != len(names) {
		t.Fatalf("accounts = %v", ids)
	}

	for _, n := range names {
		if ids[n] == "" {
			t.Fatalf("account %s missing from %v", n, ids)
		}
	}

	// Food: 230.00 at the market and the 900.00 installment purchase; Rent: 1,500.00.
	expectTotals(
		t,
		totals(t, h, "expense", "", "2026-10-01", "2026-10-31"),
		map[string]int64{ids["Food"]: 113000, ids["Rent"]: 150000},
	)
}

// expectProviders checks the providers of the book: the fixtures before version 9 carry none
// (export design T2) and later ones carry the one populate adds.
func expectProviders(t *testing.T, h *apitest.Harness, version int) {
	t.Helper()

	var list struct {
		Items []struct {
			Name     string `json:"name"`
			Instance bool   `json:"instance"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/assistant/providers", nil, http.StatusOK, &list)

	var own []string

	for _, p := range list.Items {
		if !p.Instance {
			own = append(own, p.Name)
		}
	}

	want := []string{}
	if version >= 9 {
		want = []string{"Local"}
	}

	if !slices.Equal(own, want) {
		t.Fatalf("v%d providers = %v, want %v", version, own, want)
	}
}

// expectSpreadsheets checks the spreadsheets of the book: the fixtures before version 33 carry
// none (migration 00142) and later ones carry the one populate adds, with its content.
func expectSpreadsheets(t *testing.T, h *apitest.Harness, version int) {
	t.Helper()

	var list struct {
		Items []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/spreadsheets", nil, http.StatusOK, &list)

	if version < 33 {
		if len(list.Items) != 0 {
			t.Fatalf("v%d spreadsheets = %v, want none", version, list.Items)
		}

		return
	}

	if len(list.Items) != 1 || list.Items[0].Name != "Plan" {
		t.Fatalf("v%d spreadsheets = %v, want Plan", version, list.Items)
	}

	var doc struct {
		Version int `json:"version"`
		Content struct {
			ID     string                    `json:"id"`
			Sheets map[string]map[string]any `json:"sheets"`
		} `json:"content"`
	}
	h.MustDo(http.MethodGet, "/api/v1/spreadsheets/"+list.Items[0].ID, nil, http.StatusOK, &doc)

	if _, ok := doc.Content.Sheets["s1"]; doc.Version != 1 || doc.Content.ID != "plan" || !ok {
		t.Fatalf("v%d spreadsheet = %+v", version, doc)
	}
}
