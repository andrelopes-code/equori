//go:build cluster

package server_test

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/backup"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
)

const (
	copyPassword = "correct horse battery"
	backupPath   = "/api/v1/instance/backup"
)

// S215: a backup writes an encrypted copy that opens into the dump, and the folder keeps seven.
func TestClusterS215EncryptedCopy(t *testing.T) {
	bin := os.Getenv("EQUORI_TEST_POSTGRES_BIN")
	if bin == "" {
		t.Fatal("EQUORI_TEST_POSTGRES_BIN is not set; run make test-cluster")
	}

	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}

	dir, copyDir := t.TempDir(), t.TempDir()
	h := apitest.New(t, apitest.Today("2026-11-20"), apitest.SecretKeys(apitest.SecretKey, ""))
	dump := func(ctx context.Context, path string) error { return backup.Dump(ctx, bin, dsnOf(h.Pool), path) }
	restart := func(day string) {
		h.Restart(apitest.Today(day), apitest.SecretKeys(apitest.SecretKey, ""), apitest.Backups(dir, copyDir, dump))
	}

	restart("2026-11-20")
	h.Account("Nubank", "asset", "checking", nil)

	if r := h.Do(http.MethodPut, backupPath+"/copy-password", map[string]string{"password": copyPassword}); r.Status != http.StatusNoContent {
		t.Fatalf("set copy password: status = %d, want 204: %s", r.Status, r.Body)
	}

	runBackup(t, h)

	plain := filepath.Join(t.TempDir(), "plain.dump")
	copyName := fmt.Sprintf("periodic-2026-11-20-s%d.dump.age", latest)

	if err := backup.Decrypt(filepath.Join(copyDir, copyName), plain, copyPassword); err != nil {
		t.Fatal(err)
	}

	want, err := os.ReadFile(filepath.Join(dir, fmt.Sprintf("periodic-2026-11-20-s%d.dump", latest)))
	if err != nil {
		t.Fatal(err)
	}

	if got, err := os.ReadFile(plain); err != nil || !bytes.Equal(got, want) {
		t.Fatalf("decrypted copy differs from the dump (%d and %d bytes), %v", len(got), len(want), err)
	}

	for day := 10; day <= 16; day++ {
		old := filepath.Join(copyDir, fmt.Sprintf("periodic-2026-11-%d-s1.dump.age", day))
		if err := os.WriteFile(old, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	restart("2026-11-21")
	runBackup(t, h)

	entries, err := os.ReadDir(copyDir)
	if err != nil {
		t.Fatal(err)
	}

	var got []string
	for _, e := range entries {
		got = append(got, e.Name())
	}

	wantNames := []string{
		"periodic-2026-11-12-s1.dump.age", "periodic-2026-11-13-s1.dump.age", "periodic-2026-11-14-s1.dump.age",
		"periodic-2026-11-15-s1.dump.age", "periodic-2026-11-16-s1.dump.age",
		copyName, fmt.Sprintf("periodic-2026-11-21-s%d.dump.age", latest),
	}
	if !slices.Equal(got, wantNames) {
		t.Fatalf("copies = %v, want %v", got, wantNames)
	}
}

func runBackup(t *testing.T, h *apitest.Harness) {
	t.Helper()

	if r := h.Do(http.MethodPost, backupPath, nil); r.Status != http.StatusOK {
		t.Fatalf("run backup: status = %d, want 200: %s", r.Status, r.Body)
	}
}
