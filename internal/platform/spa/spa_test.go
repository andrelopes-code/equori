package spa

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

const index = `<!doctype html><div id="root"></div>`

func TestHandler(t *testing.T) {
	t.Parallel()
	fsys := fstest.MapFS{
		"index.html":         {Data: []byte(index)},
		"assets/app-1a2b.js": {Data: []byte("console.log(1)")},
		"favicon.svg":        {Data: []byte("<svg/>")},
		"sw.js":              {Data: []byte("self")},
	}
	tests := []struct {
		name         string
		method       string
		path         string
		status       int
		body         string
		cacheControl string
		contentType  string
		allow        string
	}{
		{"root", http.MethodGet, "/", 200, index, "no-cache", "text/html; charset=utf-8", ""},
		{"client route", http.MethodGet, "/accounts/42", 200, index, "no-cache", "text/html; charset=utf-8", ""},
		{"index by name", http.MethodGet, "/index.html", 200, index, "no-cache", "text/html; charset=utf-8", ""},
		{"asset", http.MethodGet, "/assets/app-1a2b.js", 200, "console.log(1)", "public, max-age=31536000, immutable", "text/javascript; charset=utf-8", ""},
		{"root file", http.MethodGet, "/favicon.svg", 200, "<svg/>", "", "image/svg+xml", ""},
		{"service worker", http.MethodGet, "/sw.js", 200, "self", "no-cache", "text/javascript; charset=utf-8", ""},
		{"missing asset", http.MethodGet, "/assets/app-9z9z.js", 404, "404 page not found\n", "", "text/plain; charset=utf-8", ""},
		{"asset directory", http.MethodGet, "/assets/", 404, "404 page not found\n", "", "text/plain; charset=utf-8", ""},
		{"dot-dot path", http.MethodGet, "/../../etc/passwd", 200, index, "no-cache", "text/html; charset=utf-8", ""},
		{"head", http.MethodHead, "/accounts", 200, "", "no-cache", "text/html; charset=utf-8", ""},
		{"post", http.MethodPost, "/accounts", 405, "method not allowed\n", "", "text/plain; charset=utf-8", "GET, HEAD"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			Handler(fsys).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), tc.method, tc.path, nil))

			if rec.Code != tc.status {
				t.Fatalf("status = %d, want %d; body = %q", rec.Code, tc.status, rec.Body.String())
			}
			if got := rec.Body.String(); got != tc.body {
				t.Errorf("body = %q, want %q", got, tc.body)
			}
			for header, want := range map[string]string{
				"Cache-Control": tc.cacheControl,
				"Content-Type":  tc.contentType,
				"Allow":         tc.allow,
			} {
				if got := rec.Header().Get(header); got != want {
					t.Errorf("%s = %q, want %q", header, got, want)
				}
			}
		})
	}
}

func TestHandlerWithoutIndex(t *testing.T) {
	t.Parallel()
	for name, fsys := range map[string]fs.FS{"empty": fstest.MapFS{}, "nil": nil} {
		for _, path := range []string{"/", "/accounts"} {
			t.Run(name+" "+path, func(t *testing.T) {
				rec := httptest.NewRecorder()
				Handler(fsys).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil))

				if rec.Code != http.StatusNotFound {
					t.Fatalf("status = %d, want 404", rec.Code)
				}
			})
		}
	}
}

// ADR 028, development: every path outside /api/ redirects to the Vite server on the same
// host, keeping the path and the query.
func TestDevRedirect(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name, method, host, target string
		status                     int
		location                   string
	}{
		{"named host", http.MethodGet, "devserver.local:8080", "/admin?tab=categorization", http.StatusTemporaryRedirect, "http://devserver.local:5173/admin?tab=categorization"},
		{"host without a port", http.MethodGet, "127.0.0.1", "/", http.StatusTemporaryRedirect, "http://127.0.0.1:5173/"},
		{"ipv6 host", http.MethodHead, "[::1]:8080", "/accounts/42", http.StatusTemporaryRedirect, "http://[::1]:5173/accounts/42"},
		{"other method", http.MethodPost, "devserver.local:8080", "/admin", http.StatusMethodNotAllowed, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequestWithContext(t.Context(), tt.method, tt.target, nil)
			r.Host = tt.host
			w := httptest.NewRecorder()
			DevRedirect(5173).ServeHTTP(w, r)
			if w.Code != tt.status || w.Header().Get("Location") != tt.location {
				t.Fatalf("status %d, location %q; want %d, %q", w.Code, w.Header().Get("Location"), tt.status, tt.location)
			}
		})
	}
}
