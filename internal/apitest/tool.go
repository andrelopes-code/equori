package apitest

import (
	"encoding/json/v2"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Tool calls a tool of App.Tools as the harness client's user. A successful output must
// match the tool's output schema.
func (h *Harness) Tool(name string, args any) tool.Result {
	h.t.Helper()
	b, err := json.Marshal(args)
	if err != nil {
		h.t.Fatal(err)
	}
	r, err := h.App.Tools.Call(auth.WithUserID(h.t.Context(), h.OwnerID()), name, b)
	if err != nil {
		h.t.Fatalf("call tool %s: %v", name, err)
	}
	if !r.IsError {
		t, _ := h.App.Tools.Tool(name)
		if err := t.ValidateOutput(r.Content); err != nil {
			h.t.Fatalf("tool %s output %s does not match its schema: %v", name, r.Content, err)
		}
	}
	return r
}

// ExpectToolError checks a tool error; field, when not empty, must be the first field error.
func (h *Harness) ExpectToolError(r tool.Result, code, field string) {
	h.t.Helper()
	if !r.IsError {
		h.t.Fatalf("result is not an error: %s", r.Content)
	}
	var e tool.Error
	if err := json.Unmarshal(r.Content, &e); err != nil {
		h.t.Fatal(err)
	}
	if e.Code != code {
		h.t.Fatalf("code = %q, want %q: %s", e.Code, code, r.Content)
	}
	if field != "" && (len(e.Errors) == 0 || e.Errors[0].Field != field) {
		h.t.Fatalf("field errors = %+v, want %q", e.Errors, field)
	}
}
