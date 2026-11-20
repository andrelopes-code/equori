package classification_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// V19: the inverse each rule write derives from its call, or none.
func TestUndoRuleWrites(t *testing.T) {
	t.Parallel()

	h := apitest.New(t)

	tests := []struct{ name, args, result, want string }{
		{
			"rule created",
			`{"action":"create_rule","name":"Uber","description_contains":"UBER","category_id":"c"}`,
			`{"rule_id":"r1"}`,
			`{"action":"delete_rule","rule_id":"r1"}`,
		},
		{
			"alias created",
			`{"action":"create_alias","pattern":"IFD*","payee_id":"p"}`,
			`{"alias_id":"al1"}`,
			`{"action":"delete_alias","alias_id":"al1"}`,
		},
		{
			"rule changed",
			`{"action":"change_rule","rule_id":"r1","name":"x"}`,
			`{"rule_id":"r1"}`,
			"",
		},
		{"rules run", `{"action":"run_rules"}`, `{"examined":3,"categorized":1}`, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			u, ok := h.Undo("manage_rule", tt.args, tt.result)

			if ok != (tt.want != "") ||
				(ok && (u.Tool != "manage_rule" || string(u.Arguments) != tt.want)) {
				t.Fatalf("undo = %s %s, %v; want %s", u.Tool, u.Arguments, ok, tt.want)
			}
		})
	}
}
