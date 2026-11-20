package ingestion_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// V19: the confirmation and the dismissal of an investment movement are undone by its undo.
func TestUndoReviewWrites(t *testing.T) {
	t.Parallel()

	h := apitest.New(t)

	tests := []struct{ action, want string }{
		{"confirm", `{"action":"undo","movement_id":"m1"}`},
		{"dismiss", `{"action":"undo","movement_id":"m1"}`},
		{"undo", ""},
	}
	for _, tt := range tests {
		u, ok := h.Undo(
			"review_investment_movement",
			`{"action":"`+tt.action+`","movement_id":"m1"}`,
			`{"movement_id":"m1","state":"confirmed"}`,
		)

		if ok != (tt.want != "") || (ok && string(u.Arguments) != tt.want) {
			t.Fatalf("%s: undo = %s %s, %v; want %s", tt.action, u.Tool, u.Arguments, ok, tt.want)
		}
	}
}
