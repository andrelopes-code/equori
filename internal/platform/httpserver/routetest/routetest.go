// Package routetest checks that a module registers a route for every operation of its tag.
package routetest

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
)

const specPath = "../../../api/openapi.yaml"

// Check loads api/openapi.yaml, registers the module on a fresh mux and fails for each operation
// tagged tag whose method and path no registered route serves. Call it from a test in the
// module's httpapi directory.
func Check(t *testing.T, tag, baseURL string, register func(*http.ServeMux)) {
	t.Helper()

	doc, err := openapi3.NewLoader().LoadFromFile(specPath)
	if err != nil {
		t.Fatalf("load %s: %v", specPath, err)
	}

	mux := http.NewServeMux()
	register(mux)

	found := 0

	for path, item := range doc.Paths.Map() {
		for method, op := range item.Operations() {
			if !slices.Contains(op.Tags, tag) {
				continue
			}

			found++

			want := method + " " + baseURL + path
			req := httptest.NewRequestWithContext(
				context.Background(),
				method,
				baseURL+wildcardsToSegments(path),
				http.NoBody,
			)

			if _, got := mux.Handler(req); got != want {
				t.Errorf(
					"operation %s: route %q is not registered (matched %q)",
					op.OperationID,
					want,
					got,
				)
			}
		}
	}

	if found == 0 {
		t.Fatalf("no operation tagged %q in %s", tag, specPath)
	}
}

// wildcardsToSegments replaces each {name} of a path template with a literal segment.
func wildcardsToSegments(path string) string {
	var out strings.Builder

	for _, part := range strings.Split(path, "/") {
		if strings.HasPrefix(part, "{") {
			part = "x"
		}

		out.WriteString(part + "/")
	}

	return "/" + strings.Trim(out.String(), "/")
}
