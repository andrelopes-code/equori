package instance_test

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/backup"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
)

const (
	copyPasswordPath = "/api/v1/instance/backup/copy-password"
	copyPassword     = "correct horse battery"
	keyA             = "equori-test-secret-key-32-bytes!"
	keyB             = "equori-test-secret-key-B-32-byte"
)

type copyStatus struct {
	Copy struct {
		State    string     `json:"state"`
		CopiedAt *time.Time `json:"copied_at"`
		File     *string    `json:"file"`
		Late     bool       `json:"late"`
	} `json:"copy"`
}

func TestS221BackUpNowWithCopy(t *testing.T) {
	t.Parallel()

	dir, copyDir := t.TempDir(), t.TempDir()
	h := apitest.New(t, apitest.Today("2026-11-20"), apitest.SecretKeys(keyA, ""),
		apitest.Backups(dir, copyDir, apitest.FakeDump))

	setCopyPassword(t, h, copyPassword)

	before := getCopy(t, h)
	if before.Copy.State != "ok" || before.Copy.CopiedAt != nil || before.Copy.Late {
		t.Fatalf("copy before = %+v, want ok, no copied_at, not late", before.Copy)
	}

	r := h.Do(http.MethodPost, backupPath, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", r.Status, r.Body)
	}

	var got copyStatus
	r.Decode(t, &got)

	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}

	wantFile := fmt.Sprintf("periodic-2026-11-20-s%d.dump.age", latest)
	wantAt := time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC)

	if got.Copy.State != "ok" || got.Copy.CopiedAt == nil || !got.Copy.CopiedAt.Equal(wantAt) ||
		got.Copy.File == nil || *got.Copy.File != wantFile {
		t.Fatalf("copy = %+v, want ok, copied_at %s, file %s", got.Copy, wantAt, wantFile)
	}

	plain := filepath.Join(t.TempDir(), "plain.dump")
	if err := backup.Decrypt(filepath.Join(copyDir, wantFile), plain, copyPassword); err != nil {
		t.Fatal(err)
	}

	content, err := os.ReadFile(plain)
	if err != nil || string(content) != apitest.FakeDumpContent {
		t.Fatalf("decrypted copy = %q, %v; want %q", content, err, apitest.FakeDumpContent)
	}
}

func TestS217CopyFolderNotWritable(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	h := apitest.New(t, apitest.Today("2026-11-20"), apitest.SecretKeys(keyA, ""),
		apitest.Backups(dir, filepath.Join(t.TempDir(), "missing"), apitest.FakeDump))

	setCopyPassword(t, h, copyPassword)

	r := h.Do(http.MethodPost, backupPath, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", r.Status, r.Body)
	}

	var got copyStatus
	r.Decode(t, &got)

	if got.Copy.State != "folder_not_writable" || !got.Copy.Late {
		t.Fatalf("copy = %+v, want folder_not_writable and late", got.Copy)
	}

	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(filepath.Join(dir, fmt.Sprintf("periodic-2026-11-20-s%d.dump", latest))); err != nil {
		t.Fatalf("the dump is missing: %v", err)
	}
}

func TestA155PasswordLength(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.SecretKeys(keyA, ""), apitest.Backups(t.TempDir(), t.TempDir(), apitest.FakeDump))

	r := h.Do(http.MethodPut, copyPasswordPath, map[string]string{"password": "short pass1"})
	h.ExpectProblem(r, http.StatusBadRequest, "password_invalid", "")

	var p struct {
		Detail string `json:"detail"`
	}
	r.Decode(t, &p)

	if want := "the copy password needs at least 12 characters"; p.Detail != want {
		t.Fatalf("detail = %q, want %q", p.Detail, want)
	}

	if r := h.Do(http.MethodPut, copyPasswordPath, map[string]string{"password": "ççççççççççç1"}); r.Status != http.StatusNoContent {
		t.Fatalf("12 runes: status = %d, want 204: %s", r.Status, r.Body)
	}
}

func TestA155PasswordNeedsSecretKey(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Backups(t.TempDir(), t.TempDir(), apitest.FakeDump))

	r := h.Do(http.MethodPut, copyPasswordPath, map[string]string{"password": copyPassword})
	h.ExpectProblem(r, http.StatusConflict, "secret_key_missing", "")

	var p struct {
		Detail string `json:"detail"`
	}
	r.Decode(t, &p)

	if want := "the copy password needs EQUORI_SECRET_KEY"; p.Detail != want {
		t.Fatalf("detail = %q, want %q", p.Detail, want)
	}

	if got := getCopy(t, h); got.Copy.State != "password_unset" {
		t.Fatalf("copy state = %q, want password_unset", got.Copy.State)
	}
}

func TestA155PasswordAfterAnotherKey(t *testing.T) {
	t.Parallel()

	dir, copyDir := t.TempDir(), t.TempDir()
	h := apitest.New(t, apitest.SecretKeys(keyA, ""), apitest.Backups(dir, copyDir, apitest.FakeDump))

	setCopyPassword(t, h, copyPassword)

	h.Restart(apitest.SecretKeys(keyB, ""), apitest.Backups(dir, copyDir, apitest.FakeDump))

	if got := getCopy(t, h); got.Copy.State != "password_unset" {
		t.Fatalf("copy state = %q, want password_unset", got.Copy.State)
	}
}

func TestA155RotateSecrets(t *testing.T) {
	t.Parallel()

	dir, copyDir := t.TempDir(), t.TempDir()
	h := apitest.New(t, apitest.SecretKeys(keyA, ""), apitest.Backups(dir, copyDir, apitest.FakeDump))

	setCopyPassword(t, h, copyPassword)

	h.Restart(apitest.SecretKeys(keyB, keyA), apitest.Backups(dir, copyDir, apitest.FakeDump))

	n, err := h.App.Instance.RotateSecrets(t.Context())
	if err != nil || n != 1 {
		t.Fatalf("RotateSecrets = %d, %v; want 1, nil", n, err)
	}

	h.Restart(apitest.SecretKeys(keyB, ""), apitest.Backups(dir, copyDir, apitest.FakeDump))

	if got := getCopy(t, h); got.Copy.State == "password_unset" {
		t.Fatalf("copy state = %q after rotation, want a readable password", got.Copy.State)
	}
}

func getCopy(t *testing.T, h *apitest.Harness) copyStatus {
	t.Helper()

	r := h.Do(http.MethodGet, backupPath, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", r.Status, r.Body)
	}

	var got copyStatus
	r.Decode(t, &got)

	return got
}

func setCopyPassword(t *testing.T, h *apitest.Harness, password string) {
	t.Helper()

	r := h.Do(http.MethodPut, copyPasswordPath, map[string]string{"password": password})
	if r.Status != http.StatusNoContent {
		t.Fatalf("set copy password: status = %d, want 204: %s", r.Status, r.Body)
	}
}
