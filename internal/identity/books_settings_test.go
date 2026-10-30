package identity_test

import (
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const booksSettingsPath = "/api/v1/books/current"

// BK22: region and time zone belong to the active book.
func TestBooksSettings(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	initial := map[string]any{"region": "BR", "time_zone": nil, "default_time_zone": "America/Sao_Paulo"}
	assertBooksSettings(t, h, http.MethodGet, nil, initial)

	us := map[string]any{"region": "US", "time_zone": nil, "default_time_zone": "UTC"}
	assertBooksSettings(t, h, http.MethodPatch, map[string]any{"region": "US", "time_zone": nil}, us)

	var me struct {
		Region string `json:"region"`
	}
	h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &me)

	if me.Region != "US" {
		t.Fatalf("me.region = %q, want US", me.Region)
	}

	tokyo := map[string]any{"region": "BR", "time_zone": "Asia/Tokyo", "default_time_zone": "America/Sao_Paulo"}
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

			initial := map[string]any{"region": "BR", "time_zone": nil, "default_time_zone": "America/Sao_Paulo"}
			assertBooksSettings(t, h, http.MethodGet, nil, initial)
		})
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
