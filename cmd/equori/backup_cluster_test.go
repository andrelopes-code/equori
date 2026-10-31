//go:build cluster

package main

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/backup"
	"github.com/andrelopes-code/equori/internal/platform/config"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

const copyPassword = "correct horse battery"

// B1 and B3: a backup holds the database as it was; equori backup never migrates it first.
func TestClusterBackupDoesNotMigrate(t *testing.T) {
	bin := os.Getenv("EQUORI_TEST_POSTGRES_BIN")
	if bin == "" {
		t.Fatal("EQUORI_TEST_POSTGRES_BIN is not set; run make test-cluster")
	}

	pool := pgtest.Empty(t)
	if err := postgres.MigrateTo(t.Context(), pool, 5, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}

	cc := pool.Config().ConnConfig
	t.Setenv("EQUORI_DATABASE_URL", fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable", cc.Host, cc.Port, cc.User, cc.Password, cc.Database))
	t.Setenv("EQUORI_POSTGRES_BIN", bin)

	if err := backupCommand([]string{"--out", filepath.Join(t.TempDir(), "b.dump")}); err != nil {
		t.Fatal(err)
	}

	if current, _, err := postgres.Pending(t.Context(), pool); err != nil || current != 5 {
		t.Fatalf("schema version after equori backup = %d, %v; want 5", current, err)
	}
}

// S214, A154.2: external mode with EQUORI_BACKUP_DIR dumps before it applies pending migrations.
func TestClusterS214ExternalBackupBeforeMigrating(t *testing.T) {
	pool, cfg := externalAt(t, 5)

	db, err := openDatabase(t.Context(), cfg, discardLogger(), true)
	if err != nil {
		t.Fatal(err)
	}

	defer db.Close(discardLogger())

	newest, err := backup.Newest(cfg.BackupDir, backup.PreMigration)
	if err != nil {
		t.Fatal(err)
	}

	if !strings.HasSuffix(newest, "-s5.dump") {
		t.Fatalf("newest pre-migration backup = %q; want a name ending in -s5.dump", newest)
	}

	version, err := backup.DumpVersion(t.Context(), cfg.PostgresBin, newest)
	if err != nil || version != 5 {
		t.Fatalf("version of %s = %d, %v; want 5", newest, version, err)
	}

	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}

	if current, _, err := postgres.Pending(t.Context(), pool); err != nil || current != latest {
		t.Fatalf("schema version after openDatabase = %d, %v; want %d", current, err, latest)
	}
}

// S214, A154.4: a failed pre-migration backup stops the migration in external mode.
func TestClusterS214FailedBackupStopsMigration(t *testing.T) {
	pool, cfg := externalAt(t, 5)

	bin := t.TempDir()
	if err := os.WriteFile(filepath.Join(bin, "postgres"), []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil { //nolint:gosec // G306: the script must be executable.
		t.Fatal(err)
	}

	cfg.PostgresBin = bin

	_, err := openDatabase(t.Context(), cfg, discardLogger(), true)
	if err == nil || !strings.Contains(err.Error(), "back up before migrating into "+cfg.BackupDir) {
		t.Fatalf("openDatabase error = %v; want it to contain %q", err, "back up before migrating into "+cfg.BackupDir)
	}

	if current, _, err := postgres.Pending(t.Context(), pool); err != nil || current != 5 {
		t.Fatalf("schema version after the failed backup = %d, %v; want 5", current, err)
	}
}

// A154: equori backup without --out writes into EQUORI_BACKUP_DIR in both modes.
func TestClusterBackupDefaultsToBackupDir(t *testing.T) {
	pool, cfg := externalAt(t, 5)

	t.Setenv("EQUORI_DATABASE_URL", cfg.DatabaseURL)
	t.Setenv("EQUORI_POSTGRES_BIN", cfg.PostgresBin)
	t.Setenv("EQUORI_BACKUP_DIR", cfg.BackupDir)

	if err := backupCommand(nil); err != nil {
		t.Fatal(err)
	}

	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}

	want := filepath.Join(cfg.BackupDir, backup.Name(backup.Manual, time.Now().UTC(), latest))

	entries, err := os.ReadDir(cfg.BackupDir)
	if err != nil {
		t.Fatal(err)
	}

	if len(entries) != 1 || filepath.Join(cfg.BackupDir, entries[0].Name()) != want {
		t.Fatalf("files in %s = %v; want only %s", cfg.BackupDir, entries, want)
	}

	if current, _, err := postgres.Pending(t.Context(), pool); err != nil || current != 5 {
		t.Fatalf("schema version after equori backup = %d, %v; want 5", current, err)
	}
}

// A156: a wrong copy password stops the restore before it touches the database or leaves a plain dump.
func TestClusterRestoreWrongCopyPassword(t *testing.T) {
	source, cfg := externalAt(t, latestVersion(t))
	insertKept(t, source)

	t.Setenv("EQUORI_DATABASE_URL", cfg.DatabaseURL)
	t.Setenv("EQUORI_POSTGRES_BIN", cfg.PostgresBin)
	t.Setenv("TMPDIR", t.TempDir())

	copyFile := encryptedCopy(t, cfg, copyPassword)
	stdinHolds(t, "wrong password 12\n")

	err := restoreCommand([]string{copyFile})
	if err == nil || err.Error() != "the copy password does not open this file" {
		t.Fatalf("restoreCommand error = %v; want %q", err, "the copy password does not open this file")
	}

	if n := keptRows(t, source); n != 1 {
		t.Fatalf("rows named kept after the failed restore = %d; want 1", n)
	}

	left, err := filepath.Glob(filepath.Join(os.TempDir(), "equori-restore-*.dump"))
	if err != nil || len(left) != 0 {
		t.Fatalf("plain dumps left in %s = %v, %v; want none", os.TempDir(), left, err)
	}
}

// A156: the right copy password restores the copy into another database.
func TestClusterRestoreCopyCommand(t *testing.T) {
	source, cfg := externalAt(t, latestVersion(t))
	insertKept(t, source)

	copyFile := encryptedCopy(t, cfg, copyPassword)
	target := pgtest.Empty(t)

	t.Setenv("EQUORI_DATABASE_URL", dsnOf(target))
	t.Setenv("EQUORI_POSTGRES_BIN", cfg.PostgresBin)
	stdinHolds(t, copyPassword+"\n")

	if err := restoreCommand([]string{copyFile}); err != nil {
		t.Fatal(err)
	}

	target.Reset()

	if n := keptRows(t, target); n != 1 {
		t.Fatalf("rows named kept in the target = %d; want 1", n)
	}
}

// externalAt returns an empty database migrated to version and an external-mode configuration for it.
func externalAt(t *testing.T, version int64) (*pgxpool.Pool, config.Config) {
	t.Helper()

	bin := os.Getenv("EQUORI_TEST_POSTGRES_BIN")
	if bin == "" {
		t.Fatal("EQUORI_TEST_POSTGRES_BIN is not set; run make test-cluster")
	}

	pool := pgtest.Empty(t)
	if err := postgres.MigrateTo(t.Context(), pool, version, discardLogger()); err != nil {
		t.Fatal(err)
	}

	return pool, config.Config{
		DatabaseURL: dsnOf(pool),
		BackupDir:   t.TempDir(),
		PostgresBin: bin,
	}
}

// encryptedCopy dumps the database of cfg and returns the path of its copy under password.
func encryptedCopy(t *testing.T, cfg config.Config, password string) string {
	t.Helper()

	dump := filepath.Join(t.TempDir(), "equori-2026-11-20-s1.dump")
	if err := backup.Dump(t.Context(), cfg.PostgresBin, cfg.DatabaseURL, dump); err != nil {
		t.Fatal(err)
	}

	dir := t.TempDir()

	name, err := backup.Encrypt(dump, dir, password)
	if err != nil {
		t.Fatal(err)
	}

	return filepath.Join(dir, name)
}

// stdinHolds replaces os.Stdin with a file that holds text until the test ends.
func stdinHolds(t *testing.T, text string) {
	t.Helper()

	path := filepath.Join(t.TempDir(), "stdin")
	if err := os.WriteFile(path, []byte(text), 0o600); err != nil {
		t.Fatal(err)
	}

	f, err := os.Open(path) //nolint:gosec // G304: a file the test wrote.
	if err != nil {
		t.Fatal(err)
	}

	previous := os.Stdin
	os.Stdin = f

	t.Cleanup(func() {
		os.Stdin = previous
		_ = f.Close()
	})
}

func latestVersion(t *testing.T) int64 {
	t.Helper()

	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}

	return latest
}

func insertKept(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	if _, err := pool.Exec(t.Context(), `INSERT INTO identity_books (region, name) VALUES ('US', 'kept')`); err != nil {
		t.Fatal(err)
	}
}

func keptRows(t *testing.T, pool *pgxpool.Pool) int {
	t.Helper()

	var n int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM identity_books WHERE name = 'kept'`).Scan(&n); err != nil {
		t.Fatal(err)
	}

	return n
}

func dsnOf(pool *pgxpool.Pool) string {
	cc := pool.Config().ConnConfig
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable", cc.Host, cc.Port, cc.User, cc.Password, cc.Database)
}

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}
