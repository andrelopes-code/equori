//go:build unix

package backup

import (
	"os"
	"testing"
)

// A155.1: a copy is mode 0644, so the user of the mounted folder on the host can read it.
func assertCopyMode(t *testing.T, path string) {
	t.Helper()

	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o644 {
		t.Fatalf("copy mode = %v, %v; want 0644", info.Mode().Perm(), err)
	}
}

func assertPlaintextMode(t *testing.T, path string) {
	t.Helper()

	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("file mode = %v, %v; want 0600", info.Mode().Perm(), err)
	}
}
