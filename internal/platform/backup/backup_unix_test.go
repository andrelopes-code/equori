//go:build cluster && unix

package backup

import (
	"os"
	"testing"
)

// B1: a dump is mode 0600 on Unix.
func assertPrivateMode(t *testing.T, path string) {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("dump mode = %v, %v; want 0600", info.Mode().Perm(), err)
	}
}
