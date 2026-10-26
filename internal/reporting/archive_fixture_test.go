package reporting_test

import (
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

var update = flag.Bool("update", false, "write the fixture archive of a new archive_version to testdata")

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
	expectTotals(t, totals(t, h, "expense", "", "2026-10-01", "2026-10-31"), map[string]int64{ids["Food"]: 113000, ids["Rent"]: 150000})
}
