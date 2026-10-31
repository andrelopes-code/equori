package instance_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
)

const backupPath = "/api/v1/instance/backup"

type backupStatus struct {
	Backups struct {
		State          string     `json:"state"`
		PeriodicAt     *time.Time `json:"periodic_at"`
		PreMigrationAt *time.Time `json:"pre_migration_at"`
		Late           bool       `json:"late"`
	} `json:"backups"`
	Copy struct {
		State string `json:"state"`
	} `json:"copy"`
}

func TestA157BackupOff(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-20"))

	r := h.Do(http.MethodGet, backupPath, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", r.Status, r.Body)
	}

	var got backupStatus
	r.Decode(t, &got)

	if got.Backups.State != "off" || got.Backups.PeriodicAt != nil || got.Backups.Late || got.Copy.State != "folder_unset" {
		t.Fatalf("status = %+v, want off, no periodic file, not late, folder_unset", got)
	}

	h.ExpectProblem(h.Do(http.MethodPost, backupPath, nil), http.StatusConflict, "backup_off", "")
}

func TestA157RunBackup(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	h := apitest.New(t, apitest.Today("2026-11-20"), apitest.Backups(dir, "", apitest.FakeDump))

	r := h.Do(http.MethodPost, backupPath, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", r.Status, r.Body)
	}

	var got backupStatus
	r.Decode(t, &got)

	want := time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC)
	if got.Backups.State != "on" || got.Backups.PeriodicAt == nil || !got.Backups.PeriodicAt.Equal(want) || got.Backups.Late {
		t.Fatalf("backups = %+v, want on, periodic_at %s, not late", got.Backups, want)
	}

	if got.Copy.State != "folder_unset" {
		t.Fatalf("copy state = %q, want folder_unset", got.Copy.State)
	}

	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}

	content, err := os.ReadFile(filepath.Join(dir, fmt.Sprintf("periodic-2026-11-20-s%d.dump", latest)))
	if err != nil {
		t.Fatal(err)
	}

	if string(content) != apitest.FakeDumpContent {
		t.Fatalf("dump = %q, want %q", content, apitest.FakeDumpContent)
	}
}

func TestA157BackupLate(t *testing.T) {
	t.Parallel()

	t.Run("newest periodic file 49 hours old", func(t *testing.T) {
		t.Parallel()

		dir := t.TempDir()
		file := filepath.Join(dir, "periodic-2026-11-18-s1.dump")

		if err := os.WriteFile(file, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}

		old := time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC).Add(-49 * time.Hour)
		if err := os.Chtimes(file, old, old); err != nil {
			t.Fatal(err)
		}

		h := apitest.New(t, apitest.Today("2026-11-20"), apitest.Backups(dir, "", apitest.FakeDump))
		if got := getBackup(t, h); !got.Backups.Late {
			t.Fatalf("late = false, want true: %+v", got)
		}
	})

	t.Run("no periodic file", func(t *testing.T) {
		t.Parallel()

		h := apitest.New(t, apitest.Today("2026-11-20"), apitest.Backups(t.TempDir(), "", apitest.FakeDump))

		got := getBackup(t, h)
		if got.Backups.State != "on" || !got.Backups.Late {
			t.Fatalf("backups = %+v, want on and late", got.Backups)
		}
	})
}

func TestA157PeriodicRetention(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	for day := 1; day <= 7; day++ {
		if err := os.WriteFile(filepath.Join(dir, fmt.Sprintf("periodic-2026-11-0%d-s1.dump", day)), []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	h := apitest.New(t, apitest.Today("2026-11-20"), apitest.Backups(dir, "", apitest.FakeDump))

	if r := h.Do(http.MethodPost, backupPath, nil); r.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", r.Status, r.Body)
	}

	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}

	var got []string
	for _, e := range entries {
		got = append(got, e.Name())
	}

	want := []string{
		"periodic-2026-11-02-s1.dump", "periodic-2026-11-03-s1.dump", "periodic-2026-11-04-s1.dump",
		"periodic-2026-11-05-s1.dump", "periodic-2026-11-06-s1.dump", "periodic-2026-11-07-s1.dump",
		fmt.Sprintf("periodic-2026-11-20-s%d.dump", latest),
	}
	if !slices.Equal(got, want) {
		t.Fatalf("files = %v, want %v", got, want)
	}
}

func TestA157BackupFailed(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	failing := func(ctx context.Context, path string) error {
		return errors.New("pg_dump: row 'Zebra 4410'")
	}
	h := apitest.New(t, apitest.Today("2026-11-20"), apitest.Backups(dir, "", failing))

	r := h.Do(http.MethodPost, backupPath, nil)
	h.ExpectProblem(r, http.StatusInternalServerError, "backup_failed", "")

	var p struct {
		Detail string `json:"detail"`
	}
	r.Decode(t, &p)

	if want := "the backup failed; the server log holds the cause"; p.Detail != want {
		t.Fatalf("detail = %q, want %q", p.Detail, want)
	}

	if strings.Contains(string(r.Body), "Zebra") {
		t.Fatalf("response leaks the dump error: %s", r.Body)
	}

	if !slices.ContainsFunc(strings.Split(h.Logs(), "\n"), func(line string) bool {
		return strings.Contains(line, "level=ERROR") && strings.Contains(line, "Zebra 4410")
	}) {
		t.Fatalf("no error log line holds the cause:\n%s", h.Logs())
	}

	partial, err := filepath.Glob(filepath.Join(dir, "*.partial"))
	if err != nil {
		t.Fatal(err)
	}

	if len(partial) != 0 {
		t.Fatalf("partial files = %v, want none", partial)
	}
}

// S218 is extended by the tasks that add operations to the instance module.
func TestS218MemberGetsAdminRequired(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Backups(t.TempDir(), "", apitest.FakeDump))
	member := h.LoginMember("bob@example.com")

	h.ExpectProblem(h.Call(member, http.MethodGet, backupPath, nil), http.StatusForbidden, "admin_required", "")
	h.ExpectProblem(h.Call(member, http.MethodPost, backupPath, nil), http.StatusForbidden, "admin_required", "")
}

func getBackup(t *testing.T, h *apitest.Harness) backupStatus {
	t.Helper()

	r := h.Do(http.MethodGet, backupPath, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", r.Status, r.Body)
	}

	var got backupStatus
	r.Decode(t, &got)

	return got
}
