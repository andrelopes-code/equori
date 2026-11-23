package spa

import (
	"compress/gzip"
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
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
		{
			"client route",
			http.MethodGet,
			"/accounts/42",
			200,
			index,
			"no-cache",
			"text/html; charset=utf-8",
			"",
		},
		{
			"index by name",
			http.MethodGet,
			"/index.html",
			200,
			index,
			"no-cache",
			"text/html; charset=utf-8",
			"",
		},
		{
			"asset",
			http.MethodGet,
			"/assets/app-1a2b.js",
			200,
			"console.log(1)",
			"public, max-age=31536000, immutable",
			"text/javascript; charset=utf-8",
			"",
		},
		{"root file", http.MethodGet, "/favicon.svg", 200, "<svg/>", "", "image/svg+xml", ""},
		{
			"service worker",
			http.MethodGet,
			"/sw.js",
			200,
			"self",
			"no-cache",
			"text/javascript; charset=utf-8",
			"",
		},
		{
			"missing asset",
			http.MethodGet,
			"/assets/app-9z9z.js",
			404,
			"404 page not found\n",
			"",
			"text/plain; charset=utf-8",
			"",
		},
		{
			"asset directory",
			http.MethodGet,
			"/assets/",
			404,
			"404 page not found\n",
			"",
			"text/plain; charset=utf-8",
			"",
		},
		{
			"dot-dot path",
			http.MethodGet,
			"/../../etc/passwd",
			200,
			index,
			"no-cache",
			"text/html; charset=utf-8",
			"",
		},
		{"head", http.MethodHead, "/accounts", 200, "", "no-cache", "text/html; charset=utf-8", ""},
		{
			"post",
			http.MethodPost,
			"/accounts",
			405,
			"method not allowed\n",
			"",
			"text/plain; charset=utf-8",
			"GET, HEAD",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			Handler(
				fsys,
			).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), tc.method, tc.path, nil))

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
				Handler(
					fsys,
				).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil))

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
		{
			"named host",
			http.MethodGet,
			"devserver.local:8080",
			"/admin?tab=categorization",
			http.StatusTemporaryRedirect,
			"http://devserver.local:5173/admin?tab=categorization",
		},
		{
			"host without a port",
			http.MethodGet,
			"127.0.0.1",
			"/",
			http.StatusTemporaryRedirect,
			"http://127.0.0.1:5173/",
		},
		{
			"ipv6 host",
			http.MethodHead,
			"[::1]:8080",
			"/accounts/42",
			http.StatusTemporaryRedirect,
			"http://[::1]:5173/accounts/42",
		},
		{
			"other method",
			http.MethodPost,
			"devserver.local:8080",
			"/admin",
			http.StatusMethodNotAllowed,
			"",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequestWithContext(t.Context(), tt.method, tt.target, nil)
			r.Host = tt.host
			w := httptest.NewRecorder()
			DevRedirect(5173).ServeHTTP(w, r)

			if w.Code != tt.status || w.Header().Get("Location") != tt.location {
				t.Fatalf(
					"status %d, location %q; want %d, %q",
					w.Code,
					w.Header().Get("Location"),
					tt.status,
					tt.location,
				)
			}
		})
	}
}

// A text file of the build is sent compressed to a browser that accepts gzip: the bundles are
// megabytes of JavaScript. A small file, an image and a browser that does not ask stay as is.
func TestHandlerCompresses(t *testing.T) {
	t.Parallel()

	script := strings.Repeat("console.log('equori');\n", 400)
	fsys := fstest.MapFS{
		"index.html":           {Data: []byte(index)},
		"assets/app-1a2b.js":   {Data: []byte(script)},
		"assets/small-3c4d.js": {Data: []byte("console.log(1)")},
		"assets/logo-5e6f.png": {Data: []byte(strings.Repeat("\x89PNG", 400))},
	}
	h := Handler(fsys)

	tests := []struct {
		name     string
		path     string
		accept   string
		encoding string
		want     string
	}{
		{"script", "/assets/app-1a2b.js", "gzip, deflate, br", "gzip", script},
		{"script again, from the cache", "/assets/app-1a2b.js", "gzip", "gzip", script},
		{"no gzip asked", "/assets/app-1a2b.js", "", "", script},
		{"gzip refused", "/assets/app-1a2b.js", "gzip;q=0, br", "", script},
		{"small file", "/assets/small-3c4d.js", "gzip", "", "console.log(1)"},
		{"image", "/assets/logo-5e6f.png", "gzip", "", strings.Repeat("\x89PNG", 400)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, tt.path, nil)
			if tt.accept != "" {
				req.Header.Set("Accept-Encoding", tt.accept)
			}

			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			res := rec.Result()
			defer res.Body.Close()

			if res.StatusCode != http.StatusOK ||
				res.Header.Get("Content-Encoding") != tt.encoding {
				t.Fatalf(
					"status %d, Content-Encoding %q, want 200 and %q",
					res.StatusCode, res.Header.Get("Content-Encoding"), tt.encoding,
				)
			}

			var body io.Reader = res.Body

			if tt.encoding == "gzip" {
				if rec.Body.Len() >= len(tt.want) {
					t.Fatalf("sent %d bytes for a file of %d", rec.Body.Len(), len(tt.want))
				}

				zr, err := gzip.NewReader(res.Body)
				if err != nil {
					t.Fatal(err)
				}

				body = zr
			}

			got, err := io.ReadAll(body)
			if err != nil || string(got) != tt.want {
				t.Fatalf(
					"body of %d bytes, %v; want the %d bytes of the file",
					len(got),
					err,
					len(tt.want),
				)
			}

			if strings.HasSuffix(tt.path, ".js") && len(tt.want) > 1024 &&
				res.Header.Get("Vary") != "Accept-Encoding" {
				t.Errorf("Vary = %q, want Accept-Encoding", res.Header.Get("Vary"))
			}

			if got := res.Header.Get(
				"Cache-Control",
			); got != "public, max-age=31536000, immutable" {
				t.Errorf("Cache-Control = %q", got)
			}
		})
	}
}
