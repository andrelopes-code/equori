package winsvc

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

// W-S4: a log over the limit moves to .1 at start; a smaller one is appended to.
func TestOpenLogRotates(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	path := filepath.Join(dir, "log", "equori.log")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	big := bytes.Repeat([]byte("x"), 11<<20)
	if err := os.WriteFile(path, big, 0o600); err != nil {
		t.Fatal(err)
	}
	f, err := OpenLog(path, 10<<20)
	if err != nil {
		t.Fatal(err)
	}
	_ = f.Close()
	if info, err := os.Stat(path); err != nil || info.Size() != 0 {
		t.Fatalf("log after rotation: %v, %v; want an empty file", info, err)
	}
	if info, err := os.Stat(path + ".1"); err != nil || info.Size() != int64(len(big)) {
		t.Fatalf("rotated log: %v, %v; want %d bytes", info, err, len(big))
	}

	if err := os.WriteFile(path, []byte("kept\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	f, err = OpenLog(path, 10<<20)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.WriteString("next\n"); err != nil {
		t.Fatal(err)
	}
	_ = f.Close()
	if b, err := os.ReadFile(path); err != nil || string(b) != "kept\nnext\n" {
		t.Fatalf("log = %q, %v; want the old line and the new one", b, err)
	}
}

// W-S4: the log directory is created on the first start.
func TestOpenLogCreatesTheDirectory(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "log", "equori.log")
	f, err := OpenLog(path, 10<<20)
	if err != nil {
		t.Fatal(err)
	}
	_ = f.Close()
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
}
