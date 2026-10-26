package pgcluster

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
)

// sun_path holds 104 bytes on macOS and 108 on Linux, the terminating NUL included.
const socketLimit = 103

func socketDir(dataDir string) (string, error) {
	abs, err := filepath.Abs(dataDir)
	if err != nil {
		return "", fmt.Errorf("resolve data directory: %w", err)
	}
	run := filepath.Join(abs, "run")
	if len(run)+len("/.s.PGSQL.5432") <= socketLimit {
		return run, nil
	}
	sum := sha256.Sum256([]byte(abs))
	return filepath.Join(os.TempDir(), "equori-"+hex.EncodeToString(sum[:])[:12]), nil
}

// ensurePrivateDir creates path with mode 0700 and refuses one that another user could enter:
// the fallback of socketDir lives in a shared temporary directory.
func ensurePrivateDir(path string) error {
	if err := os.MkdirAll(path, 0o700); err != nil {
		return fmt.Errorf("create %s: %w", path, err)
	}
	info, err := os.Lstat(path)
	if err != nil {
		return fmt.Errorf("inspect %s: %w", path, err)
	}
	if !info.IsDir() || info.Mode().Perm() != 0o700 {
		return fmt.Errorf("%s must be a directory with mode 0700, found %v", path, info.Mode())
	}
	return nil
}
