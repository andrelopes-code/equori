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

// Assistant parity design AP1 and AP4: set_appearance merges the choices into the stored
// document and leaves the saved themes and the book accents as they are; get_appearance reads
// the choices.
func TestSetAppearanceTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	stored := map[string]any{"scheme": "dark", "themes": "[]", "bookAccents": `{"1":"rose"}`}
	h.MustDo(http.MethodPut, appearancePath, stored, http.StatusOK, nil)

	args := map[string]any{
		"scheme":      "light",
		"density":     "dense",
		"text_size":   "110",
		"accent":      "#112233",
		"amount_tone": "sign",
	}

	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}

	p, r, err := h.App.Tools.Preview(
		auth.WithIdentity(
			t.Context(),
			h.MemberIDOf("owner@example.com"),
			h.BooksIDOf("owner@example.com"),
			auth.RoleOwner,
		),
		"set_appearance",
		b,
	)
	if err != nil || r.IsError {
		t.Fatalf("preview = %v, %s", err, r.Content)
	}

	want := tool.Preview{Action: "set_appearance", Changes: []tool.Change{
		{Field: "scheme", Before: tool.TextValue("dark"), After: tool.TextValue("light")},
		{Field: "density", After: tool.TextValue("dense")},
		{Field: "text_size", After: tool.TextValue("110")},
		{Field: "amount_tone", After: tool.TextValue("sign")},
		{Field: "accent", After: tool.TextValue("#112233")},
	}}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}

	r = h.Tool("set_appearance", args)
	if r.IsError {
		t.Fatalf("set_appearance = error %s", r.Content)
	}

	var receipt map[string]string
	if err := json.Unmarshal(r.Content, &receipt); err != nil {
		t.Fatal(err)
	}

	wantReceipt := map[string]string{
		"scheme": "light", "density": "dense", "textSize": "110", "accent": "#112233",
		"amountTone": "sign",
	}
	if !reflect.DeepEqual(receipt, wantReceipt) {
		t.Errorf("receipt = %v, want %v", receipt, wantReceipt)
	}

	var got map[string]any
	h.MustDo(http.MethodGet, appearancePath, nil, http.StatusOK, &got)

	wantStored := map[string]any{
		"scheme": "light", "density": "dense", "textSize": "110", "accent": "#112233",
		"amountTone": "sign", "themes": "[]", "bookAccents": `{"1":"rose"}`,
	}
	if !reflect.DeepEqual(got, wantStored) {
		t.Errorf("stored = %v, want %v", got, wantStored)
	}

	r = h.Tool("get_appearance", map[string]any{})
	if r.IsError {
		t.Fatalf("get_appearance = error %s", r.Content)
	}

	var read map[string]string
	if err := json.Unmarshal(r.Content, &read); err != nil {
		t.Fatal(err)
	}

	if !reflect.DeepEqual(read, wantReceipt) {
		t.Errorf("get_appearance = %v, want %v", read, wantReceipt)
	}
}

func TestSetAppearanceToolRefusesValues(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	for _, tc := range []struct {
		args  map[string]any
		field string
	}{
		{map[string]any{}, ""},
		{map[string]any{"scheme": "neon"}, ""},
		{map[string]any{"text_size": "87"}, ""},
		{map[string]any{"text_size": "150"}, ""},
		{map[string]any{"accent": "red"}, "accent"},
		{map[string]any{"visual": "glass"}, ""},
	} {
		h.ExpectToolError(h.Tool("set_appearance", tc.args), "invalid_arguments", tc.field)
	}
}
