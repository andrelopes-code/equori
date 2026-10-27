//go:build unix

package secret

import (
	"os"
	"testing"
)

// C3: the key file is mode 0600 on Unix.
func assertPrivateMode(t *testing.T, path string) {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("mode = %v, %v; want 0600", info.Mode().Perm(), err)
	}
}
