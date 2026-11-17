package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type faceView struct {
	Color       *string `json:"color"`
	Art         *string `json:"art"`
	Chip        *string `json:"chip"`
	Orientation *string `json:"orientation"`
	Brand       *string `json:"brand"`
}

type faceAccountView struct {
	ID   string    `json:"id"`
	Face *faceView `json:"face"`
}

// Card faces spec 4.9 (B2, D1, D2): the appearance of a credit card is set, replaced as a whole,
// read back and cleared.
func TestAccountCardFace(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	card := h.Card("Roxinho", 3, 10, "next")
	path := "/api/v1/accounts/" + card + "/card-face"

	var set faceAccountView
	h.MustDo(http.MethodPut, path, map[string]any{
		"color": "#820ad1", "art": "aurora", "chip": "silver",
		"orientation": "vertical", "brand": "plate",
	}, http.StatusOK, &set)
	assertFace(t, set.Face, "#820ad1", "aurora", "silver", "vertical", "plate")

	var read faceAccountView
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+card, nil, http.StatusOK, &read)
	assertFace(t, read.Face, "#820ad1", "aurora", "silver", "vertical", "plate")

	var replaced faceAccountView
	h.MustDo(http.MethodPut, path, map[string]any{"color": "#fce300"}, http.StatusOK, &replaced)
	assertFace(t, replaced.Face, "#fce300", "", "", "", "")

	var cleared faceAccountView
	h.MustDo(http.MethodPut, path, map[string]any{}, http.StatusOK, &cleared)

	if cleared.Face != nil {
		t.Fatalf("cleared face = %+v, want none", *cleared.Face)
	}

	var after faceAccountView
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+card, nil, http.StatusOK, &after)

	if after.Face != nil {
		t.Fatalf("read back face = %+v, want none", *after.Face)
	}
}

// A card face is valid only on a credit card account (the problem RequireCard gives).
func TestAccountCardFaceRequiresCard(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Checking", "asset", "checking", nil)

	h.ExpectProblem(
		h.Do(http.MethodPut, "/api/v1/accounts/"+checking+"/card-face",
			map[string]any{"color": "#820ad1"}),
		http.StatusUnprocessableEntity, "validation_failed", "account_id",
	)
}

// The OpenAPI patterns and enums refuse an invalid value before the domain sees it.
func TestAccountCardFaceRejections(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	card := h.Card("Roxinho", 3, 10, "next")

	for _, body := range []map[string]any{
		{"color": "#GGGGGG"},
		{"color": "#820AD1"},
		{"art": "A B"},
		{"chip": "bronze"},
		{"orientation": "diagonal"},
		{"brand": "logo"},
	} {
		h.ExpectProblem(
			h.Do(http.MethodPut, "/api/v1/accounts/"+card+"/card-face", body),
			http.StatusBadRequest, "invalid_request", "",
		)
	}
}

func TestAccountCardFaceRoles(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	card := h.Card("Roxinho", 3, 10, "next")
	path := "/api/v1/accounts/" + card + "/card-face"
	body := map[string]any{"color": "#820ad1"}
	owner := h.OwnerID()

	reader := h.JoinAs("reader@example.com", owner, "read")
	h.ExpectProblem(
		h.Call(reader, http.MethodPut, path, body),
		http.StatusForbidden, "book_role_required", "",
	)

	writer := h.JoinAs("writer@example.com", owner, "write")
	if r := h.Call(writer, http.MethodPut, path, body); r.Status != http.StatusOK {
		t.Fatalf("write status = %d: %s", r.Status, r.Body)
	}

	outsider := h.LoginMember("outsider@example.com")
	if r := h.Call(outsider, http.MethodPut, path, body); r.Status != http.StatusNotFound {
		t.Fatalf("outsider status = %d, want 404: %s", r.Status, r.Body)
	}
}

func assertFace(t *testing.T, got *faceView, color, art, chip, orientation, brand string) {
	t.Helper()

	if got == nil {
		t.Fatal("face is absent")
	}

	for _, c := range []struct {
		name string
		got  *string
		want string
	}{
		{"color", got.Color, color},
		{"art", got.Art, art},
		{"chip", got.Chip, chip},
		{"orientation", got.Orientation, orientation},
		{"brand", got.Brand, brand},
	} {
		switch {
		case c.want == "" && c.got != nil:
			t.Fatalf("%s = %q, want absent", c.name, *c.got)
		case c.want != "" && (c.got == nil || *c.got != c.want):
			t.Fatalf("%s = %v, want %q", c.name, c.got, c.want)
		}
	}
}
