package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// TestSetCardFaceTool sets the face of a credit card through the tool, replaces it as a whole
// and clears it, as card faces spec 4.9 states.
func TestSetCardFaceTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	card := h.Card("Roxinho", 3, 10, "next")
	full := map[string]any{
		"account_id": card, "color": "#820ad1", "art": "aurora", "chip": "silver",
		"orientation": "vertical", "brand": "plate",
	}

	p := previewTool(t, h, "set_card_face", full)
	if p.Target != "Roxinho" || p.Changes[0].After.Text != "#820ad1" {
		t.Fatalf("preview = %+v", p)
	}

	if r := h.Tool("set_card_face", full); r.IsError {
		t.Fatalf("set = %s", r.Content)
	}

	var read faceAccountView
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+card, nil, http.StatusOK, &read)
	assertFace(t, read.Face, "#820ad1", "aurora", "silver", "vertical", "plate")

	if r := h.Tool("set_card_face", map[string]any{"account_id": card}); r.IsError {
		t.Fatalf("clear = %s", r.Content)
	}

	var cleared faceAccountView
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+card, nil, http.StatusOK, &cleared)

	if cleared.Face != nil {
		t.Fatalf("cleared face = %+v, want none", *cleared.Face)
	}

	h.ExpectToolError(
		h.Tool("set_card_face", map[string]any{"account_id": card, "color": "purple"}),
		"validation_failed",
		"face.color",
	)
}
