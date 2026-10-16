// Package apidoc serves the HTTP contract and an interactive reference for it.
package apidoc

import (
	_ "embed"
	"net/http"
)

// reference.html loads Scalar from jsDelivr at a pinned version with a Subresource Integrity hash.
//
//go:embed reference.html
var reference []byte

// Register adds GET /openapi.yaml, which returns contract, and GET /docs, which renders it.
// Both routes sit outside /api/ and need no session.
func Register(mux *http.ServeMux, contract []byte) {
	mux.HandleFunc("GET /openapi.yaml", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/yaml")
		_, _ = w.Write(contract)
	})
	mux.HandleFunc("GET /docs", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(reference)
	})
}
