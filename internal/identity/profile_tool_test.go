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
	args := map[string]any{"language": "en", "region": "US"}
	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}
	p, r, err := h.App.Tools.Preview(auth.WithUserID(t.Context(), h.OwnerID()), "update_profile", b)
	if err != nil || r.IsError {
		t.Fatalf("preview = %v, %s", err, r.Content)
	}
	want := tool.Preview{Action: "update_profile", Changes: []tool.Change{
		{Field: "language", Before: tool.TextValue("pt"), After: tool.TextValue("en")},
		{Field: "region", Before: tool.TextValue("BR"), After: tool.TextValue("US")},
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
	if got != (me{"en", "US"}) {
		t.Errorf("profile = %+v, want en US", got)
	}

	h.ExpectToolError(h.Tool("update_profile", map[string]any{}), "invalid_arguments", "language")
	h.ExpectToolError(h.Tool("update_profile", map[string]any{"region": "Brazil"}), "validation_failed", "region")
}
