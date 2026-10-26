package backup

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestName(t *testing.T) {
	t.Parallel()
	got := Name(Periodic, time.Date(2026, 10, 26, 23, 0, 0, 0, time.UTC), 60)
	if got != "periodic-2026-10-26-s60.dump" {
		t.Fatal(got)
	}
}

func touch(t *testing.T, dir, name string, mod time.Time) {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(path, mod, mod); err != nil {
		t.Fatal(err)
	}
}

func TestPruneKeepsTheNewest(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	for day := 1; day <= 9; day++ {
		touch(t, dir, fmt.Sprintf("periodic-2026-10-%02d-s60.dump", day), time.Now())
	}
	touch(t, dir, "pre-migration-2026-10-01-s59.dump", time.Now())
	if err := Prune(dir, Periodic, 7); err != nil {
		t.Fatal(err)
	}
	names, _ := filepath.Glob(filepath.Join(dir, "*.dump"))
	if len(names) != 8 || filepath.Base(names[0]) != "periodic-2026-10-03-s60.dump" || filepath.Base(names[7]) != "pre-migration-2026-10-01-s59.dump" {
		t.Fatalf("after Prune: %v", names)
	}
}

func TestDue(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC)
	dir := t.TempDir()
	if due, err := Due(dir, now, 24*time.Hour); err != nil || !due {
		t.Fatalf("empty directory: %v, %v; want due", due, err)
	}
	touch(t, dir, "periodic-2026-10-26-s60.dump", now.Add(-23*time.Hour))
	if due, _ := Due(dir, now, 24*time.Hour); due {
		t.Fatal("23 hours old: want not due")
	}
	touch(t, dir, "periodic-2026-10-26-s60.dump", now.Add(-24*time.Hour))
	if due, _ := Due(dir, now, 24*time.Hour); !due {
		t.Fatal("24 hours old: want due")
	}
}

func TestNewest(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	if got, err := Newest(dir, PreMigration); err != nil || got != "" {
		t.Fatalf("empty: %q, %v", got, err)
	}
	touch(t, dir, "pre-migration-2026-10-01-s59.dump", time.Now())
	touch(t, dir, "pre-migration-2026-10-20-s60.dump", time.Now())
	if got, _ := Newest(dir, PreMigration); got != filepath.Join(dir, "pre-migration-2026-10-20-s60.dump") {
		t.Fatal(got)
	}
}

func TestParseDumpVersion(t *testing.T) {
	t.Parallel()
	script := "SET x;\nCOPY public.goose_db_version (id, version_id, is_applied, tstamp) FROM stdin;\n1\t0\tt\t2026-10-01 00:00:00\n2\t1\tt\t2026-10-01 00:00:00\n61\t60\tt\t2026-10-26 00:00:00\n\\.\n"
	if got, err := parseDumpVersion(script); err != nil || got != 60 {
		t.Fatalf("parseDumpVersion = %d, %v; want 60", got, err)
	}
	if _, err := parseDumpVersion("SET x;\n"); err == nil {
		t.Fatal("no COPY block: want an error")
	}
}
