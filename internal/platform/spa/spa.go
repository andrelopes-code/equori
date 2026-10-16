// Package spa serves a single-page application from a file system.
package spa

import (
	"io"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

const (
	indexName = "index.html"
	assetsDir = "assets"
)

// Handler serves the files of fsys and answers every other path with index.html,
// so the browser resolves client routes. Paths under assets/ never fall back:
// a stale hashed bundle name must fail as 404, not load HTML as a script.
// A nil fsys, or one without index.html, answers 404.
func Handler(fsys fs.FS) http.Handler {
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
		if serveFile(w, r, fsys, name) {
			return
		}
		if name == assetsDir || strings.HasPrefix(name, assetsDir+"/") || !serveFile(w, r, fsys, indexName) {
			http.NotFound(w, r)
		}
	})
}

// serveFile reports false, writing nothing, when name is not a regular file of fsys.
func serveFile(w http.ResponseWriter, r *http.Request, fsys fs.FS, name string) bool {
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
	case name == indexName:
		w.Header().Set("Cache-Control", "no-cache")
	case strings.HasPrefix(name, assetsDir+"/"):
		// Vite names every file under assets/ by its content hash.
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}
	// ServeContent serves index.html under its own name; http.ServeFileFS would redirect it to "./".
	http.ServeContent(w, r, name, info.ModTime(), content)
	return true
}
