package identity_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestProfile(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	var me struct {
		Language string `json:"language"`
		Region   string `json:"region"`
	}
	h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &me)
	if me.Language != "pt" || me.Region != "BR" {
		t.Fatalf("me = %+v", me)
	}
	h.MustDo(http.MethodPatch, "/api/v1/me", map[string]any{"language": "en", "region": "GB"}, http.StatusOK, &me)
	h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &me)
	if me.Language != "en" || me.Region != "GB" {
		t.Fatalf("after patch = %+v", me)
	}
	h.ExpectProblem(h.Do(http.MethodPatch, "/api/v1/me", map[string]any{"region": "ZZ"}), http.StatusUnprocessableEntity, "validation_failed", "region")
	h.ExpectProblem(h.Do(http.MethodPatch, "/api/v1/me", map[string]any{"region": "bra"}), http.StatusBadRequest, "invalid_request", "region")
}
