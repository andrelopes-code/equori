//go:build cluster

package server_test

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/backup"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
	"github.com/andrelopes-code/equori/internal/server"
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

// S216: the copy opens with its password, restores into an empty database, and a server on that
// database answers with the balances and the net worth of the source.
func TestClusterS216EncryptedCopyRestores(t *testing.T) {
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

	h.Restart(apitest.Today("2026-11-20"), apitest.SecretKeys(apitest.SecretKey, ""), apitest.Backups(dir, copyDir, dump))

	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	reserve := h.Account("Reserve", "asset", "reserve", nil)
	h.Record("2026-10-14", apitest.Posting(checking, -23000), apitest.Posting(food, 23000))
	h.Record("2026-11-02", apitest.Posting(checking, -50000), apitest.Posting(reserve, 50000))
	h.Dispatch()

	if r := h.Do(http.MethodPut, backupPath+"/copy-password", map[string]string{"password": copyPassword}); r.Status != http.StatusNoContent {
		t.Fatalf("set copy password: status = %d, want 204: %s", r.Status, r.Body)
	}

	paths := []string{
		"/api/v1/accounts/" + checking + "/balance?date=2026-11-20",
		"/api/v1/accounts/" + food + "/balance?date=2026-11-20",
		"/api/v1/accounts/" + reserve + "/balance?date=2026-11-20",
		"/api/v1/reports/net-worth?date=2026-11-20",
	}
	wantTables := snapshot(t, h.Pool)
	wantBodies := readBodies(t, h, h.Client, h.URL(), paths)

	runBackup(t, h)

	plain := filepath.Join(t.TempDir(), "plain.dump")
	if err := backup.Decrypt(filepath.Join(copyDir, fmt.Sprintf("periodic-2026-11-20-s%d.dump.age", latest)), plain, copyPassword); err != nil {
		t.Fatal(err)
	}

	target := pgtest.Empty(t)
	if err := backup.Restore(t.Context(), bin, dsnOf(target), plain, latest); err != nil {
		t.Fatal(err)
	}

	target.Reset()

	if got := snapshot(t, target); !slices.Equal(got, wantTables) {
		t.Fatalf("restored copy differs:\n got %v\nwant %v", got, wantTables)
	}

	restored := restoredServer(t, h, target)
	gotBodies := readBodies(t, h, restored.client, restored.url, paths)

	for i, path := range paths {
		if !bytes.Equal(gotBodies[i], wantBodies[i]) {
			t.Fatalf("GET %s after the restore = %s, want %s", path, gotBodies[i], wantBodies[i])
		}
	}
}

func runBackup(t *testing.T, h *apitest.Harness) {
	t.Helper()

	if r := h.Do(http.MethodPost, backupPath, nil); r.Status != http.StatusOK {
		t.Fatalf("run backup: status = %d, want 200: %s", r.Status, r.Body)
	}
}

type restoredInstance struct {
	url    string
	client *http.Client
}

// restoredServer serves target at the clock of the source harness with the session cookies of h.
func restoredServer(t *testing.T, h *apitest.Harness, target *pgxpool.Pool) restoredInstance {
	t.Helper()

	var cfg server.Config
	apitest.Today("2026-11-20")(&cfg)

	app, err := server.New(target, cfg, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewServer(app.Handler)
	t.Cleanup(srv.Close)

	from, err := url.Parse(h.URL())
	if err != nil {
		t.Fatal(err)
	}

	to, err := url.Parse(srv.URL)
	if err != nil {
		t.Fatal(err)
	}

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}

	jar.SetCookies(to, h.Client.Jar.Cookies(from))

	return restoredInstance{url: srv.URL, client: &http.Client{Jar: jar}}
}

// readBodies returns the raw body of each GET path, after it checks the status 200.
func readBodies(t *testing.T, h *apitest.Harness, c *http.Client, base string, paths []string) [][]byte {
	t.Helper()

	bodies := make([][]byte, 0, len(paths))

	for _, path := range paths {
		req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, base+path, nil)
		if err != nil {
			t.Fatal(err)
		}

		r := h.Send(c, req)
		if r.Status != http.StatusOK {
			t.Fatalf("GET %s: status = %d, want 200: %s", path, r.Status, r.Body)
		}

		bodies = append(bodies, r.Body)
	}

	return bodies
}
