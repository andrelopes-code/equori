package server_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// ADR 008.
func TestWebIsServedOutsideAPI(t *testing.T) {
	t.Parallel()
	const index = `<!doctype html><div id="root"></div>`
	h := apitest.New(t, apitest.Web(fstest.MapFS{"index.html": {Data: []byte(index)}}))

	r := h.Do(http.MethodGet, "/accounts", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", r.Status, r.Body)
	}
	if string(r.Body) != index {
		t.Errorf("body = %q, want %q", r.Body, index)
	}
	if got, want := r.Header.Get("Content-Security-Policy"), "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"; got != want {
		t.Errorf("Content-Security-Policy = %q, want %q", got, want)
	}

	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/nope", nil), http.StatusNotFound, "not_found", "")
}

// The web app manifest and its icon are same-origin files under web/public; the CSP is default-src 'self'.
func TestWebServesManifestAndIcon(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Web(fstest.MapFS{
		"index.html":    {Data: []byte(`<!doctype html><div id="root"></div>`)},
		"manifest.json": {Data: []byte(`{"name":"equori"}`)},
		"icon.svg":      {Data: []byte(`<svg xmlns="http://www.w3.org/2000/svg"/>`)},
	}))

	tests := []struct {
		path, body, contentType string
	}{
		{"/manifest.json", `{"name":"equori"}`, "application/json"},
		{"/icon.svg", `<svg xmlns="http://www.w3.org/2000/svg"/>`, "image/svg+xml"},
	}
	for _, tc := range tests {
		t.Run(tc.path, func(t *testing.T) {
			r := h.Do(http.MethodGet, tc.path, nil)
			if r.Status != http.StatusOK {
				t.Fatalf("status = %d, want 200; body = %s", r.Status, r.Body)
			}
			if string(r.Body) != tc.body {
				t.Errorf("body = %q, want %q", r.Body, tc.body)
			}
			if got := r.Header.Get("Content-Type"); !strings.HasPrefix(got, tc.contentType) {
				t.Errorf("Content-Type = %q, want prefix %q", got, tc.contentType)
			}
		})
	}
}

// ADR 008, development: with the Vite port set, pages redirect to the Vite server, which
// serves the current sources; the API stays here.
func TestWebRedirectsToTheDevServer(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.WebDevPort(5173))

	r := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/admin", nil)
	r.Host = "devserver.local:8080"
	w := httptest.NewRecorder()
	h.App.Handler.ServeHTTP(w, r)
	if w.Code != http.StatusTemporaryRedirect || w.Header().Get("Location") != "http://devserver.local:5173/admin" {
		t.Fatalf("status %d, location %q", w.Code, w.Header().Get("Location"))
	}
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/nope", nil), http.StatusNotFound, "not_found", "")
}
