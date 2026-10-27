package pgcluster

import (
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
