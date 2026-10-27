package pgcluster

import (
	"errors"
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
