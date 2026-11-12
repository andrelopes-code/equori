package layout_test

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"
)

const (
	repoRoot       = "../../.."
	maxFileLines   = 400
	maxFuncLines   = 50
	maxMainLines   = 80
	maxGoDirFiles  = 40
	maxWebDirFiles = 40
)

// webExempt lists the web directories that hold tokens and generated files, not screens.
var webExempt = map[string]bool{"web/src/theme": true}

// TestGoFileSize rejects a hand-written Go file above maxFileLines (ADR 035). A file listed in
// long_files.txt is allowed until it no longer offends.
func TestGoFileSize(t *testing.T) {
	allowed := readList(t, "long_files.txt")
	offenders := map[string]bool{}

	for _, path := range handWrittenGo(t) {
		data, err := os.ReadFile(filepath.Join(repoRoot, path))
		if err != nil {
			t.Fatal(err)
		}

		lines := bytes.Count(data, []byte("\n"))
		if lines <= maxFileLines {
			continue
		}

		offenders[path] = true

		if !allowed[path] {
			t.Errorf("%s has %d lines; split it by concept (limit %d)", path, lines, maxFileLines)
		}
	}

	for key := range allowed {
		if !offenders[key] {
			t.Errorf(
				"long_files.txt: %s no longer exceeds %d lines; remove the entry",
				key,
				maxFileLines,
			)
		}
	}
}

// TestGoFunctionSize rejects a function body above maxFuncLines (ADR 035). Body lines are the
// lines between the braces, exclusive. A function listed in long_functions.txt is allowed until
// it no longer offends.
func TestGoFunctionSize(t *testing.T) {
	allowed := readList(t, "long_functions.txt")
	offenders := map[string]bool{}

	for _, path := range handWrittenGo(t) {
		for name, lines := range functionBodies(t, path) {
			if lines <= maxFuncLines {
				continue
			}

			key := path + "\t" + name
			offenders[key] = true

			if !allowed[key] {
				t.Errorf("%s %s has %d body lines; split it into steps (limit %d)",
					path, name, lines, maxFuncLines)
			}
		}
	}

	for key := range allowed {
		if !offenders[key] {
			t.Errorf("long_functions.txt: %q no longer exceeds %d lines; remove the entry",
				key, maxFuncLines)
		}
	}
}

// TestMainSize rejects a cmd/equori/main.go above maxMainLines: main.go holds main and run only.
func TestMainSize(t *testing.T) {
	data, err := os.ReadFile(filepath.Join(repoRoot, "cmd/equori/main.go"))
	if err != nil {
		t.Fatal(err)
	}

	lines := bytes.Count(data, []byte("\n"))
	if lines > maxMainLines {
		t.Errorf(
			"cmd/equori/main.go has %d lines; move code by concept (limit %d)",
			lines,
			maxMainLines,
		)
	}
}

// TestGoDirectorySize rejects a directory with more than maxGoDirFiles hand-written non-test Go
// files. A directory listed in long_dirs.txt is allowed up to its own limit.
func TestGoDirectorySize(t *testing.T) {
	for _, problem := range checkDirs(countByDir(handWrittenGo(t)), readLimits(t, "long_dirs.txt")) {
		t.Error(problem)
	}
}

func TestCheckDirs(t *testing.T) {
	tests := []struct {
		name   string
		counts map[string]int
		limits map[string]int
		want   []string
	}{
		{
			name:   "directory within the default limit",
			counts: map[string]int{"a": 40},
			want:   nil,
		},
		{
			name:   "unlisted directory above the default limit",
			counts: map[string]int{"a": 41},
			want: []string{
				"a holds 41 Go files; group them or list it in long_dirs.txt (limit 40)",
			},
		},
		{
			name:   "listed directory within its limit",
			counts: map[string]int{"a": 55},
			limits: map[string]int{"a": 60},
			want:   nil,
		},
		{
			name:   "listed directory above its limit",
			counts: map[string]int{"a": 61},
			limits: map[string]int{"a": 60},
			want:   []string{"a holds 61 Go files; group them (limit 60)"},
		},
		{
			name:   "stale entry",
			counts: map[string]int{"a": 40},
			limits: map[string]int{"a": 60},
			want:   []string{"long_dirs.txt: a holds 40 Go files, at most 40; remove the entry"},
		},
		{
			name:   "entry of a directory without files",
			counts: map[string]int{},
			limits: map[string]int{"a": 60},
			want:   []string{"long_dirs.txt: a holds 0 Go files, at most 40; remove the entry"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := checkDirs(tt.counts, tt.limits)
			if strings.Join(got, "\n") != strings.Join(tt.want, "\n") {
				t.Errorf("checkDirs = %q, want %q", got, tt.want)
			}
		})
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

// checkDirs returns one message per directory above its limit and per listed directory that
// holds at most maxGoDirFiles files. The messages are sorted by directory.
func checkDirs(counts map[string]int, limits map[string]int) []string {
	dirs := map[string]bool{}

	for dir := range counts {
		dirs[dir] = true
	}

	for dir := range limits {
		dirs[dir] = true
	}

	var problems []string

	for dir := range dirs {
		count := counts[dir]
		limit, listed := limits[dir]

		switch {
		case !listed && count > maxGoDirFiles:
			problems = append(problems, fmt.Sprintf(
				"%s holds %d Go files; group them or list it in long_dirs.txt (limit %d)",
				dir, count, maxGoDirFiles))
		case listed && count <= maxGoDirFiles:
			problems = append(problems, fmt.Sprintf(
				"long_dirs.txt: %s holds %d Go files, at most %d; remove the entry",
				dir, count, maxGoDirFiles))
		case listed && count > limit:
			problems = append(problems, fmt.Sprintf(
				"%s holds %d Go files; group them (limit %d)", dir, count, limit))
		}
	}

	sort.Strings(problems)

	return problems
}

func countByDir(files []string) map[string]int {
	counts := map[string]int{}

	for _, f := range files {
		counts[filepath.ToSlash(filepath.Dir(f))]++
	}

	return counts
}

// readList returns the keys of an allow-list: each line holds the key columns and a final
// reason column, separated by tabs.
func readList(t *testing.T, name string) map[string]bool {
	t.Helper()

	data, err := os.ReadFile(name)
	if err != nil {
		t.Fatal(err)
	}

	keys := map[string]bool{}

	for _, line := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		if line == "" {
			continue
		}

		cut := strings.LastIndex(line, "\t")
		if cut < 0 {
			t.Fatalf("%s: line %q has no reason column", name, line)
		}

		keys[line[:cut]] = true
	}

	return keys
}

// functionBodies maps each function of a file, as Name or Recv.Name, to its body line count.
func functionBodies(t *testing.T, path string) map[string]int {
	t.Helper()

	fset := token.NewFileSet()

	file, err := parser.ParseFile(fset, filepath.Join(repoRoot, path), nil, 0)
	if err != nil {
		t.Fatal(err)
	}

	bodies := map[string]int{}

	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Body == nil {
			continue
		}

		lines := fset.Position(fn.Body.Rbrace).Line - fset.Position(fn.Body.Lbrace).Line - 1
		bodies[funcKey(fn)] = lines
	}

	return bodies
}

func funcKey(fn *ast.FuncDecl) string {
	if fn.Recv == nil || len(fn.Recv.List) == 0 {
		return fn.Name.Name
	}

	expr := fn.Recv.List[0].Type
	if star, ok := expr.(*ast.StarExpr); ok {
		expr = star.X
	}

	switch x := expr.(type) {
	case *ast.IndexExpr:
		expr = x.X
	case *ast.IndexListExpr:
		expr = x.X
	}

	return fmt.Sprintf("%s.%s", recvName(expr), fn.Name.Name)
}

func recvName(expr ast.Expr) string {
	if id, ok := expr.(*ast.Ident); ok {
		return id.Name
	}

	return "?"
}

// readLimits returns the directory limits of long_dirs.txt: dir, limit and reason, tab separated.
func readLimits(t *testing.T, name string) map[string]int {
	t.Helper()

	data, err := os.ReadFile(name)
	if err != nil {
		t.Fatal(err)
	}

	limits := map[string]int{}

	for _, line := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		if line == "" {
			continue
		}

		cols := strings.Split(line, "\t")
		if len(cols) != 3 {
			t.Fatalf("%s: line %q needs dir, limit and reason", name, line)
		}

		limit, err := strconv.Atoi(cols[1])
		if err != nil {
			t.Fatalf("%s: line %q: %v", name, line, err)
		}

		limits[cols[0]] = limit
	}

	return limits
}
