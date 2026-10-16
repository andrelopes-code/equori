package server_test

import (
	"net/http"
	"testing"
	"testing/fstest"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// ADR 008.
func TestWebIsServedOutsideAPI(t *testing.T) {
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
