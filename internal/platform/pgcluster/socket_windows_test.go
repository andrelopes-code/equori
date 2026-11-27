package pgcluster

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// W-M5: no temporary-directory fallback on Windows; a long path names EQUORI_DATA_DIR.
func TestSocketDirTooLong(t *testing.T) {
	t.Parallel()

	short := t.TempDir()
	if got, err := socketDir(short); err != nil || got != filepath.Join(short, "run") {
		t.Fatalf("socketDir(%q) = %q, %v", short, got, err)
	}

	_, err := socketDir(filepath.Join(short, strings.Repeat("a", 100)))
	if err == nil || !strings.Contains(err.Error(), "EQUORI_DATA_DIR") {
		t.Fatalf("socketDir of a long path = %v, want an error naming EQUORI_DATA_DIR", err)
	}
}

// PW4.2: postgres.exe writes the socket path in the ANSI code page and Go dials it in UTF-8, so a
// folder such as C:\Users\João reaches the socket only through its ASCII short name.
func TestSocketNameOfAFolderOutsideASCII(t *testing.T) {
	t.Parallel()

	dir := filepath.Join(t.TempDir(), "equori smoke Jo\u00e3o", "run")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}

	got, err := socketName(dir)
	if err != nil {
		t.Fatal(err)
	}

	if !isASCII(got) {
		t.Fatalf("socketName(%q) = %q, want an ASCII path", dir, got)
	}

	long, err := os.Stat(dir)
	if err != nil {
		t.Fatal(err)
	}

	short, err := os.Stat(got)
	if err != nil || !os.SameFile(long, short) {
		t.Fatalf("socketName(%q) = %q, which is not the same folder (%v)", dir, got, err)
	}

	ascii := t.TempDir()
	if got, err := socketName(ascii); err != nil || got != ascii {
		t.Fatalf("socketName(%q) = %q, %v; want the path unchanged", ascii, got, err)
	}
}
