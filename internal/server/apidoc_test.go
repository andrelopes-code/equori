package server_test

import (
	"bytes"
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/api"
	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestAPIDocs(t *testing.T) {
	h := apitest.New(t, apitest.APIDocs())
	anonymous := &http.Client{}

	r := h.Call(anonymous, http.MethodGet, "/openapi.yaml", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("GET /openapi.yaml status %d: %s", r.Status, r.Body)
	}
	if got := r.Header.Get("Content-Type"); got != "application/yaml" {
		t.Fatalf("GET /openapi.yaml Content-Type = %q", got)
	}
	if !bytes.Equal(r.Body, api.Contract) {
		t.Fatal("GET /openapi.yaml body differs from api.Contract")
	}

	r = h.Call(anonymous, http.MethodGet, "/docs", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("GET /docs status %d: %s", r.Status, r.Body)
	}
	if got := r.Header.Get("Content-Type"); got != "text/html; charset=utf-8" {
		t.Fatalf("GET /docs Content-Type = %q", got)
	}
	if !strings.Contains(string(r.Body), `data-url="/openapi.yaml"`) {
		t.Fatalf("GET /docs does not reference /openapi.yaml: %s", r.Body)
	}
}

func TestAPIDocsDisabledByDefault(t *testing.T) {
	h := apitest.New(t)
	for _, path := range []string{"/openapi.yaml", "/docs"} {
		if r := h.Call(&http.Client{}, http.MethodGet, path, nil); r.Status != http.StatusNotFound {
			t.Fatalf("GET %s status %d, want 404", path, r.Status)
		}
	}
}
