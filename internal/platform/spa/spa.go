// Package spa serves a single-page application from a file system.
package spa

import (
	"bytes"
	"compress/gzip"
	"io"
	"io/fs"
	"net"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"sync"
)

const (
	indexName = "index.html"
	assetsDir = "assets"

	// minCompressBytes is the size from which a file is sent compressed; below it the gzip
	// header outweighs what the compression saves.
	minCompressBytes = 1024
)

// compressible holds the extensions of the text files of the build. Images and fonts are
// compressed formats already.
var compressible = map[string]bool{
	".html": true,
	".js":   true,
	".css":  true,
	".json": true,
	".svg":  true,
}

// contentTypes fixes the types of the files the web build emits. On Windows, mime reads the
// registry, which may map .js to text/plain, and a browser then refuses to run the modules.
var contentTypes = map[string]string{
	".html":  "text/html; charset=utf-8",
	".js":    "text/javascript; charset=utf-8",
	".css":   "text/css; charset=utf-8",
	".json":  "application/json",
	".svg":   "image/svg+xml",
	".png":   "image/png",
	".woff2": "font/woff2",
}

// Handler serves the files of fsys and answers every other path with index.html,
// so the browser resolves client routes. Paths under assets/ never fall back:
// a stale hashed bundle name must fail as 404, not load HTML as a script.
// A nil fsys, or one without index.html, answers 404.
func Handler(fsys fs.FS) http.Handler {
	// The compressed bytes of each file sent so far. The files of a build never change while the
	// process runs, so a file is compressed once.
	zipped := &sync.Map{}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)

			return
		}

		if fsys == nil {
			http.NotFound(w, r)
			return
		}

		name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if serveFile(w, r, fsys, zipped, name) {
			return
		}

		if name == assetsDir || strings.HasPrefix(name, assetsDir+"/") ||
			!serveFile(w, r, fsys, zipped, indexName) {
			http.NotFound(w, r)
		}
	})
}

// serveFile reports false, writing nothing, when name is not a regular file of fsys.
func serveFile(
	w http.ResponseWriter,
	r *http.Request,
	fsys fs.FS,
	zipped *sync.Map,
	name string,
) bool {
	f, err := fsys.Open(name)
	if err != nil {
		return false
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		return false
	}

	content, ok := f.(io.ReadSeeker)
	if !ok {
		return false
	}

	switch {
	case name == indexName || name == "sw.js":
		// The browser must see a new service worker on the next load (ADR 028, W11; ADR 022, P2).
		w.Header().Set("Cache-Control", "no-cache")
	case strings.HasPrefix(name, assetsDir+"/"):
		// Vite names every file under assets/ by its content hash.
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}

	if ct, ok := contentTypes[path.Ext(name)]; ok {
		w.Header().Set("Content-Type", ct)
	}

	if compressible[path.Ext(name)] && info.Size() >= minCompressBytes {
		// A cache between the browser and the application keeps one answer per encoding.
		w.Header().Add("Vary", "Accept-Encoding")

		if gz, ok := gzipped(zipped, name, content); ok && acceptsGzip(r) {
			w.Header().Set("Content-Encoding", "gzip")

			content = bytes.NewReader(gz)
		}
	}

	// ServeContent serves index.html under its own name; http.ServeFileFS would redirect it to "./".
	http.ServeContent(w, r, name, info.ModTime(), content)

	return true
}

// gzipped returns the compressed bytes of the file name, compressing content on the first
// call. It reports false, leaving content at its start, when the file does not compress.
func gzipped(zipped *sync.Map, name string, content io.ReadSeeker) ([]byte, bool) {
	if gz, ok := zipped.Load(name); ok {
		b, isBytes := gz.([]byte)
		return b, isBytes
	}

	var buf bytes.Buffer

	zw := gzip.NewWriter(&buf)
	_, copyErr := io.Copy(zw, content)
	closeErr := zw.Close()

	if _, err := content.Seek(0, io.SeekStart); err != nil || copyErr != nil || closeErr != nil {
		return nil, false
	}

	zipped.Store(name, buf.Bytes())

	return buf.Bytes(), true
}

// acceptsGzip reports whether the Accept-Encoding of r names gzip, or every encoding, with a
// quality other than zero (RFC 9110, 12.5.3).
func acceptsGzip(r *http.Request) bool {
	for part := range strings.SplitSeq(r.Header.Get("Accept-Encoding"), ",") {
		coding, params, _ := strings.Cut(strings.TrimSpace(part), ";")
		if coding != "gzip" && coding != "*" {
			continue
		}

		q, found := strings.CutPrefix(strings.TrimSpace(params), "q=")
		if !found {
			return true
		}

		quality, err := strconv.ParseFloat(q, 64)

		return err != nil || quality > 0
	}

	return false
}

// DevRedirect answers every GET and HEAD with a temporary redirect to the Vite server on port
// of the request's host, keeping the path and the query, so a page opened on the
// application's port shows the current sources (ADR 028, development).
func DevRedirect(port int) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)

			return
		}

		host := r.Host
		if h, _, err := net.SplitHostPort(r.Host); err == nil {
			host = h
		}

		target := url.URL{
			Scheme:   "http",
			Host:     net.JoinHostPort(host, strconv.Itoa(port)),
			Path:     r.URL.Path,
			RawQuery: r.URL.RawQuery,
		}
		http.Redirect(w, r, target.String(), http.StatusTemporaryRedirect)
	})
}
