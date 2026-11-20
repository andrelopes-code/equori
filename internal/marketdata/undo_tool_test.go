package marketdata_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// V19: hide and show of a security undo each other; the other instrument writes have no inverse.
func TestUndoInstrumentWrites(t *testing.T) {
	t.Parallel()

	h := apitest.New(t)

	tests := []struct{ action, want string }{
		{"hide", `{"action":"show","code":"PETR4"}`},
		{"show", `{"action":"hide","code":"PETR4"}`},
		{"rename", ""},
	}
	for _, tt := range tests {
		u, ok := h.Undo(
			"manage_instrument",
			`{"action":"`+tt.action+`","code":"PETR4","name":"P"}`,
			`{}`,
		)

		if ok != (tt.want != "") || (ok && string(u.Arguments) != tt.want) {
			t.Fatalf("%s: undo = %s %s, %v; want %s", tt.action, u.Tool, u.Arguments, ok, tt.want)
		}
	}
}
