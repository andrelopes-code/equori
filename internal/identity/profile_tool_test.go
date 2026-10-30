package identity_test

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func TestUpdateProfileTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	args := map[string]any{"language": "en"}

	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}

	p, r, err := h.App.Tools.Preview(auth.WithIdentity(t.Context(), h.MemberIDOf("owner@example.com"), h.BooksIDOf("owner@example.com"), auth.RoleOwner), "update_profile", b)
	if err != nil || r.IsError {
		t.Fatalf("preview = %v, %s", err, r.Content)
	}

	want := tool.Preview{Action: "update_profile", Changes: []tool.Change{
		{Field: "language", Before: tool.TextValue("pt"), After: tool.TextValue("en")},
	}}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}

	type me struct {
		Language string `json:"language"`
		Region   string `json:"region"`
	}
	var got me
	h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &got)

	if got != (me{"pt", "BR"}) {
		t.Fatalf("the preview changed the profile: %+v", got)
	}

	if r := h.Tool("update_profile", args); r.IsError {
		t.Fatalf("update_profile = error %s", r.Content)
	}

	h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &got)

	if got != (me{"en", "BR"}) {
		t.Errorf("profile = %+v, want en BR", got)
	}

	h.ExpectToolError(h.Tool("update_profile", map[string]any{}), "invalid_arguments", "language")
	h.ExpectToolError(h.Tool("update_profile", map[string]any{"region": "US"}), "invalid_arguments", "")
}
