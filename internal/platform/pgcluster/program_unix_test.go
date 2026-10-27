//go:build unix

package pgcluster

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// W-M2: a postgres file without the executable bit is not a program.
func TestBinExplicitNotExecutable(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "postgres"), []byte("#!/bin/sh\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Bin(dir); err == nil || !strings.Contains(err.Error(), "EQUORI_POSTGRES_BIN") {
		t.Fatalf("Bin of a non-executable postgres = %v; want an error naming EQUORI_POSTGRES_BIN", err)
	}
}
