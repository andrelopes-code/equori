//go:build unix

package pgcluster

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSocketDir(t *testing.T) {
	t.Parallel()
	short := t.TempDir()
	if got, err := socketDir(short); err != nil || got != filepath.Join(short, "run") {
		t.Fatalf("socketDir(%q) = %q, %v", short, got, err)
	}
	long := filepath.Join(short, strings.Repeat("a", 100))
	got, err := socketDir(long)
	if err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256([]byte(long))
	want := filepath.Join(os.TempDir(), "equori-"+hex.EncodeToString(sum[:])[:12])
	if got != want {
		t.Fatalf("socketDir(long) = %q, want %q", got, want)
	}
}

func TestPrivateDirCreates(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "run")
	if err := privateDir(path); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o700 {
		t.Fatalf("mode = %v, %v; want 0700", info.Mode().Perm(), err)
	}
}

func TestPrivateDirRefusesForeignMode(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "run")
	if err := os.Mkdir(path, 0o777); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(path, 0o777); err != nil {
		t.Fatal(err)
	}
	if err := privateDir(path); err == nil {
		t.Fatal("a directory with mode 0777: want an error")
	}
}
