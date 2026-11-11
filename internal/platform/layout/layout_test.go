package layout_test

import (
	"bytes"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

const (
	repoRoot       = "../../.."
	maxFileLines   = 600
	maxGoDirFiles  = 40
	maxWebDirFiles = 40
)

// webExempt lists the web directories that hold tokens and generated files, not screens.
var webExempt = map[string]bool{"web/src/theme": true}

// TestGoFileSize rejects a hand-written Go file above maxFileLines (ADR 033).
func TestGoFileSize(t *testing.T) {
	for _, path := range handWrittenGo(t) {
		data, err := os.ReadFile(filepath.Join(repoRoot, path))
		if err != nil {
			t.Fatal(err)
		}

		if lines := bytes.Count(data, []byte("\n")); lines > maxFileLines {
			t.Errorf("%s has %d lines; split it by concept (limit %d)", path, lines, maxFileLines)
		}
	}
}

// TestGoDirectorySize rejects a directory with more than maxGoDirFiles hand-written non-test Go files.
func TestGoDirectorySize(t *testing.T) {
	for dir, count := range countByDir(handWrittenGo(t)) {
		if count > maxGoDirFiles {
			t.Errorf("%s holds %d Go files; group them (limit %d)", dir, count, maxGoDirFiles)
		}
	}
}

// TestWebDirectorySize rejects a web/src directory with more than maxWebDirFiles files.
func TestWebDirectorySize(t *testing.T) {
	var files []string

	root := filepath.Join(repoRoot, "web", "src")

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}

		rel, err := filepath.Rel(repoRoot, path)
		if err != nil {
			return err
		}

		files = append(files, filepath.ToSlash(rel))

		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	for dir, count := range countByDir(files) {
		if count > maxWebDirFiles && !webExempt[dir] {
			t.Errorf("%s holds %d files; group them (limit %d)", dir, count, maxWebDirFiles)
		}
	}
}

// handWrittenGo lists, relative to the repository root, the Go files under internal and cmd
// that are neither tests, generated code nor test data.
func handWrittenGo(t *testing.T) []string {
	t.Helper()

	var files []string

	for _, top := range []string{"internal", "cmd"} {
		root := filepath.Join(repoRoot, top)

		err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}

			if d.IsDir() && d.Name() == "testdata" {
				return filepath.SkipDir
			}

			name := d.Name()
			if d.IsDir() || !strings.HasSuffix(name, ".go") ||
				strings.HasSuffix(name, "_test.go") || strings.HasSuffix(name, ".gen.go") {
				return nil
			}

			rel, err := filepath.Rel(repoRoot, path)
			if err != nil {
				return err
			}

			files = append(files, filepath.ToSlash(rel))

			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
	}

	sort.Strings(files)

	return files
}

func countByDir(files []string) map[string]int {
	counts := map[string]int{}

	for _, f := range files {
		counts[filepath.ToSlash(filepath.Dir(f))]++
	}

	return counts
}
