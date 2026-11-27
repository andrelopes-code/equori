package pgcluster

import (
	"errors"
	"path/filepath"
	"testing"
)

// M6, W-M6: a second lock of one data directory is refused until the first is released.
func TestLockDirBusy(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()

	f, err := lockDir(dir)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := lockDir(dir); !errors.Is(err, ErrBusy) {
		t.Fatalf("second lockDir = %v, want ErrBusy", err)
	}

	if err := f.Close(); err != nil {
		t.Fatal(err)
	}

	again, err := lockDir(dir)
	if err != nil {
		t.Fatalf("lockDir after release: %v", err)
	}

	_ = again.Close()
}

// PW3.1: Held tells a second equori.exe that an instance of the folder runs.
func TestHeld(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()

	if held, err := Held(filepath.Join(dir, "absent")); err != nil || held {
		t.Fatalf("absent directory: held=%v err=%v, want false and nil", held, err)
	}

	f, err := lockDir(dir)
	if err != nil {
		t.Fatal(err)
	}

	if held, err := Held(dir); err != nil || !held {
		t.Fatalf("locked directory: held=%v err=%v, want true and nil", held, err)
	}

	if err := f.Close(); err != nil {
		t.Fatal(err)
	}

	if held, err := Held(dir); err != nil || held {
		t.Fatalf("released directory: held=%v err=%v, want false and nil", held, err)
	}
}
