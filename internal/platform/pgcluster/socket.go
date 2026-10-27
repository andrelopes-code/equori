package pgcluster

import (
	"fmt"
	"path/filepath"
)

func socketDir(dataDir string) (string, error) {
	abs, err := filepath.Abs(dataDir)
	if err != nil {
		return "", fmt.Errorf("resolve data directory: %w", err)
	}
	run := filepath.Join(abs, "run")
	if len(run)+len("/.s.PGSQL.5432") <= socketLimit {
		return run, nil
	}
	return socketFallback(abs)
}
