package identity_test

import (
	"net/http"
	"net/http/cookiejar"
	"reflect"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const appearancePath = "/api/v1/me/appearance"

// S189: appearance follows the member across sessions.
func TestS189AppearanceFollowsMember(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}

	first := h.Client
	second := &http.Client{Jar: jar}

	login := map[string]string{"email": "owner@example.com", "password": apitest.Password}
	if r := h.Call(second, http.MethodPost, "/api/v1/session", login); r.Status != http.StatusNoContent {
		t.Fatalf("second login status %d: %s", r.Status, r.Body)
	}

	assertAppearance(t, h, second, http.MethodGet, nil, map[string]any{})

	stored := map[string]any{"scheme": "light", "accent": "#336699", "themes": "[]"}
	assertAppearance(t, h, first, http.MethodPut, stored, stored)
	assertAppearance(t, h, second, http.MethodGet, nil, stored)
}

func TestAppearanceSize(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		body   any
		status int
		code   string
	}{
		{"at the limit", map[string]any{"themes": strings.Repeat("a", 16371)}, http.StatusOK, ""},
		{"over the limit", map[string]any{"themes": strings.Repeat("a", 16372)}, http.StatusUnprocessableEntity, "appearance_too_large"},
		{"array", []any{}, http.StatusBadRequest, "invalid_request"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			h := apitest.New(t)

			before := map[string]any{"scheme": "dark"}
			assertAppearance(t, h, h.Client, http.MethodPut, before, before)

			r := h.Call(h.Client, http.MethodPut, appearancePath, tt.body)
			if r.Status != tt.status {
				t.Fatalf("PUT status = %d, want %d: %s", r.Status, tt.status, r.Body)
			}

			if tt.code == "" {
				return
			}

			h.ExpectProblem(r, tt.status, tt.code, "")
			assertAppearance(t, h, h.Client, http.MethodGet, nil, before)
		})
	}
}

// assertAppearance sends the request to /me/appearance and compares the 200 body with want.
func assertAppearance(t *testing.T, h *apitest.Harness, c *http.Client, method string, body any, want map[string]any) {
	t.Helper()

	r := h.Call(c, method, appearancePath, body)
	if r.Status != http.StatusOK {
		t.Fatalf("%s %s status = %d, want 200: %s", method, appearancePath, r.Status, r.Body)
	}

	var got map[string]any
	r.Decode(t, &got)

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("%s %s = %v, want %v", method, appearancePath, got, want)
	}
}
