package identity_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type nameMember struct {
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
}

// The member sets a display name; the profile and the member list return it, trimmed.
func TestDisplayName(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	var me nameMember

	h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &me)

	if me.DisplayName != "" {
		t.Fatalf("initial display_name = %q, want empty", me.DisplayName)
	}

	h.MustDo(http.MethodPatch, "/api/v1/me", map[string]any{"display_name": "  Ann Lee  "}, http.StatusOK, &me)

	if me.DisplayName != "Ann Lee" {
		t.Fatalf("patched display_name = %q, want %q", me.DisplayName, "Ann Lee")
	}

	var list struct {
		Items []nameMember `json:"items"`
	}

	h.MustDo(http.MethodGet, "/api/v1/books/current/members", nil, http.StatusOK, &list)

	want := []nameMember{{Email: "owner@example.com", DisplayName: "Ann Lee"}}
	if len(list.Items) != 1 || list.Items[0] != want[0] {
		t.Fatalf("members = %+v, want %+v", list.Items, want)
	}

	h.MustDo(http.MethodPatch, "/api/v1/me", map[string]any{"language": "en"}, http.StatusOK, &me)

	if me.DisplayName != "Ann Lee" {
		t.Fatalf("display_name after a patch without it = %q, want %q", me.DisplayName, "Ann Lee")
	}

	me = nameMember{}

	h.MustDo(http.MethodPatch, "/api/v1/me", map[string]any{"display_name": ""}, http.StatusOK, &me)

	if me.DisplayName != "" {
		t.Fatalf("cleared display_name = %q, want empty", me.DisplayName)
	}
}

// A read-only member changes its own display name.
func TestDisplayNameReadMember(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")

	r := h.Call(reader, http.MethodPatch, "/api/v1/me", map[string]any{"display_name": "Bob"})
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	var me nameMember

	r.Decode(t, &me)

	if me.DisplayName != "Bob" {
		t.Fatalf("display_name = %q, want Bob", me.DisplayName)
	}
}

func TestDisplayNameProblems(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value string
	}{
		{"61 characters", strings.Repeat("a", 61)},
		{"61 multibyte characters", strings.Repeat("é", 61)},
		{"line break", "Ann\nLee"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			h := apitest.New(t)

			h.ExpectProblem(
				h.Do(http.MethodPatch, "/api/v1/me", map[string]any{"display_name": tt.value}),
				http.StatusUnprocessableEntity, "validation_failed", "display_name",
			)

			var me nameMember

			h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &me)

			if me.DisplayName != "" {
				t.Fatalf("display_name after a rejected patch = %q, want empty", me.DisplayName)
			}
		})
	}
}

func TestDisplayNameAccepts60Characters(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	name := strings.Repeat("é", 60)

	var me nameMember

	h.MustDo(http.MethodPatch, "/api/v1/me", map[string]any{"display_name": name}, http.StatusOK, &me)

	if me.DisplayName != name {
		t.Fatalf("display_name = %q, want %q", me.DisplayName, name)
	}
}
