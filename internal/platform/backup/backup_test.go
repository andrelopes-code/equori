//go:build cluster

package backup

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/platform/pgcluster"
)

func testCluster(t *testing.T) *pgcluster.Cluster {
	t.Helper()
	bin := os.Getenv("EQUORI_TEST_POSTGRES_BIN")
	if bin == "" {
		t.Fatal("EQUORI_TEST_POSTGRES_BIN is not set; run make test-cluster")
	}
	c, err := pgcluster.Start(t.Context(), t.TempDir(), bin)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = c.Stop() })
	return c
}

func execSQL(t *testing.T, dsn, sql string) {
	t.Helper()
	conn, err := pgx.Connect(t.Context(), dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.Close(t.Context()) }()
	if _, err := conn.Exec(t.Context(), sql); err != nil {
		t.Fatal(err)
	}
}

func TestDumpAndRestore(t *testing.T) {
	c := testCluster(t)
	dsn := c.DSN(pgcluster.Database)
	execSQL(t, dsn, "CREATE TABLE goose_db_version (id serial, version_id bigint, is_applied boolean, tstamp timestamp DEFAULT now()); INSERT INTO goose_db_version (version_id, is_applied) VALUES (0, true), (60, true); CREATE TABLE fact (v text); INSERT INTO fact VALUES ('kept')")
	path := filepath.Join(t.TempDir(), "x.dump")
	if err := Dump(t.Context(), c.Bin(), dsn, path); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("dump mode = %v, %v; want 0600", info.Mode().Perm(), err)
	}
	if v, err := DumpVersion(t.Context(), c.Bin(), path); err != nil || v != 60 {
		t.Fatalf("DumpVersion = %d, %v", v, err)
	}
	execSQL(t, dsn, "INSERT INTO fact VALUES ('after the dump')")
	if err := Restore(t.Context(), c.Bin(), dsn, path, 60); err != nil {
		t.Fatal(err)
	}
	conn, err := pgx.Connect(t.Context(), dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.Close(t.Context()) }()
	var facts, provider string
	if err := conn.QueryRow(t.Context(), "SELECT string_agg(v, ',') FROM fact").Scan(&facts); err != nil || facts != "kept" {
		t.Fatalf("facts = %q, %v", facts, err)
	}
	if err := conn.QueryRow(t.Context(), "SELECT datlocprovider::text || ' ' || datlocale FROM pg_database WHERE datname = current_database()").Scan(&provider); err != nil || provider != "b C.UTF-8" {
		t.Fatalf("restored locale = %q, %v", provider, err)
	}
}

func TestRestoreRefusesNewerDump(t *testing.T) {
	c := testCluster(t)
	dsn := c.DSN(pgcluster.Database)
	execSQL(t, dsn, "CREATE TABLE goose_db_version (id serial, version_id bigint, is_applied boolean, tstamp timestamp DEFAULT now()); INSERT INTO goose_db_version (version_id, is_applied) VALUES (61, true); CREATE TABLE fact (v text)")
	path := filepath.Join(t.TempDir(), "x.dump")
	if err := Dump(t.Context(), c.Bin(), dsn, path); err != nil {
		t.Fatal(err)
	}
	execSQL(t, dsn, "INSERT INTO fact VALUES ('untouched')")
	if err := Restore(t.Context(), c.Bin(), dsn, path, 60); !errors.Is(err, ErrDumpAhead) {
		t.Fatalf("Restore: %v, want ErrDumpAhead", err)
	}
	execSQL(t, dsn, "SELECT 1 FROM fact WHERE v = 'untouched'")
}
