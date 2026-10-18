package web

import (
	"io/fs"
	"path"
	"strings"
	"testing"
)

// The jsdom suite runs in Node, where require exists, so only the built bundle shows a CommonJS
// shim that throws in the browser (ADR 010, Consequences). `go test` must not require Node: with
// only dist/.gitkeep the test skips; `make check` builds web/dist first, so it runs there.
func TestBuiltScriptsHaveNoCommonJSRequire(t *testing.T) {
	scripts, err := fs.Glob(Dist(), "assets/*.js")
	if err != nil {
		t.Fatal(err)
	}
	if len(scripts) == 0 {
		t.Skip("web/dist holds no built scripts; run make web-build")
	}
	for _, name := range scripts {
		body, err := fs.ReadFile(Dist(), name)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(body), "typeof require") {
			t.Errorf("%s contains \"typeof require\": a dependency bundled a CommonJS module that throws in the browser", path.Base(name))
		}
	}
}
