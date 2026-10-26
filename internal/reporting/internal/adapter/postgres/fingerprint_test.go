package postgres

import (
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

var update = flag.Bool("update", false, "write the fingerprint of a new archive_version to testdata")

// ADR 021, V6: the columns and types of every exported table are pinned per archive_version.
func TestArchiveFingerprint(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	tables, err := (&Exports{pool: pool}).ImportableTables(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	slices.Sort(tables)
	var b strings.Builder
	rows, err := pool.Query(t.Context(), `SELECT table_name || '.' || column_name || ' ' || udt_name || CASE WHEN is_nullable = 'YES' THEN ' null' ELSE '' END
		FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = ANY ($1) AND column_name <> 'user_id'
		ORDER BY table_name, column_name`, tables)
	if err != nil {
		t.Fatal(err)
	}
	lines, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatal(err)
	}
	for _, l := range lines {
		b.WriteString(l + "\n")
	}
	got := b.String()
	path := fmt.Sprintf("testdata/archive-v%d.txt", app.ArchiveVersion)
	want, err := os.ReadFile(path)
	switch {
	case errors.Is(err, fs.ErrNotExist) && *update:
		if err := os.WriteFile(path, []byte(got), 0o644); err != nil {
			t.Fatal(err)
		}
		return
	case err != nil:
		t.Fatalf("read %s: %v; run this test with -update once for a new archive_version", path, err)
	}
	if got != string(want) {
		t.Fatalf("an exported table changed under archive_version %d, whose fingerprint %s is published.\n"+
			"Increment app.ArchiveVersion, append the migration step of the archive to archiveSteps in "+
			"internal/reporting/internal/app/archive_steps.go, then run this test with -update to write the new "+
			"fingerprint and TestImportArchiveFixtures with -update to write the new fixture (ADR 021, V2, V6, V7).\n"+
			"got:\n%s", app.ArchiveVersion, path, got)
	}
}
