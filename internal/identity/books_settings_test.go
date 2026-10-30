package identity_test

import (
	"net/http"
	"reflect"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const booksSettingsPath = "/api/v1/books/current"

// BK22: region and time zone belong to the active book.
func TestBooksSettings(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	initial := map[string]any{"region": "BR", "time_zone": nil, "default_time_zone": "America/Sao_Paulo", "name": "owner@example.com"}
	assertBooksSettings(t, h, http.MethodGet, nil, initial)

	us := map[string]any{"region": "US", "time_zone": nil, "default_time_zone": "UTC", "name": "owner@example.com"}
	assertBooksSettings(t, h, http.MethodPatch, map[string]any{"region": "US", "time_zone": nil}, us)

	var me struct {
		Region string `json:"region"`
	}
	h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &me)

	if me.Region != "US" {
		t.Fatalf("me.region = %q, want US", me.Region)
	}

	tokyo := map[string]any{"region": "BR", "time_zone": "Asia/Tokyo", "default_time_zone": "America/Sao_Paulo", "name": "owner@example.com"}
	assertBooksSettings(t, h, http.MethodPatch, map[string]any{"region": "BR", "time_zone": "Asia/Tokyo"}, tokyo)
	assertBooksSettings(t, h, http.MethodGet, nil, tokyo)
}

func TestBooksSettingsProblems(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		method string
		path   string
		body   map[string]any
		status int
		code   string
		field  string
	}{
		{"unknown zone", http.MethodPatch, booksSettingsPath, map[string]any{"region": "BR", "time_zone": "Mars/Olympus"}, http.StatusUnprocessableEntity, "time_zone_invalid", ""},
		{"Local", http.MethodPatch, booksSettingsPath, map[string]any{"region": "BR", "time_zone": "Local"}, http.StatusUnprocessableEntity, "time_zone_invalid", ""},
		{"empty", http.MethodPatch, booksSettingsPath, map[string]any{"region": "BR", "time_zone": ""}, http.StatusUnprocessableEntity, "time_zone_invalid", ""},
		{"unknown region", http.MethodPatch, booksSettingsPath, map[string]any{"region": "ZZ", "time_zone": nil}, http.StatusUnprocessableEntity, "validation_failed", "region"},
		{"region pattern", http.MethodPatch, booksSettingsPath, map[string]any{"region": "bra", "time_zone": nil}, http.StatusBadRequest, "invalid_request", "region"},
		{"region on me", http.MethodPatch, "/api/v1/me", map[string]any{"region": "US"}, http.StatusBadRequest, "invalid_request", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			h := apitest.New(t)

			h.ExpectProblem(h.Do(tt.method, tt.path, tt.body), tt.status, tt.code, tt.field)

			initial := map[string]any{"region": "BR", "time_zone": nil, "default_time_zone": "America/Sao_Paulo", "name": "owner@example.com"}
			assertBooksSettings(t, h, http.MethodGet, nil, initial)
		})
	}
}

// HA1: a book has a name; PATCH changes it only when the body carries it.
func TestBooksName(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	tests := []struct {
		name   string
		method string
		body   map[string]any
		status int
		want   string
		field  string
	}{
		{"default", http.MethodGet, nil, http.StatusOK, "owner@example.com", ""},
		{"rename", http.MethodPatch, map[string]any{"region": "BR", "time_zone": nil, "name": "Casa"}, http.StatusOK, "Casa", ""},
		{"absent keeps", http.MethodPatch, map[string]any{"region": "BR", "time_zone": nil}, http.StatusOK, "Casa", ""},
		{"empty", http.MethodPatch, map[string]any{"region": "BR", "time_zone": nil, "name": ""}, http.StatusBadRequest, "", "name"},
		{"81 characters", http.MethodPatch, map[string]any{"region": "BR", "time_zone": nil, "name": strings.Repeat("a", 81)}, http.StatusBadRequest, "", "name"},
	}

	for _, tt := range tests {
		r := h.Do(tt.method, booksSettingsPath, tt.body)
		if tt.status != http.StatusOK {
			h.ExpectProblem(r, tt.status, "invalid_request", tt.field)

			continue
		}

		if r.Status != tt.status {
			t.Fatalf("%s: status %d: %s", tt.name, r.Status, r.Body)
		}

		var got struct {
			Name string `json:"name"`
		}
		r.Decode(t, &got)

		if got.Name != tt.want {
			t.Errorf("%s: name = %q, want %q", tt.name, got.Name, tt.want)
		}
	}
}

// assertBooksSettings sends the request to /books/current and compares the 200 body with want.
func assertBooksSettings(t *testing.T, h *apitest.Harness, method string, body any, want map[string]any) {
	t.Helper()

	var got map[string]any
	h.MustDo(method, booksSettingsPath, body, http.StatusOK, &got)

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("%s %s = %v, want %v", method, booksSettingsPath, got, want)
	}
}
