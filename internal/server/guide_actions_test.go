package server_test

import (
	"regexp"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/assistant"
)

// TestGuideActionsExist checks that every "<tool> action <name>" of the assistant's guide names
// a tool of the catalog and a value of its action enum.
func TestGuideActionsExist(t *testing.T) {
	t.Parallel()

	tools := map[string][]any{}
	for _, tl := range chatTools(t) {
		var enum []any
		if action := tl.InputSchema().Properties["action"]; action != nil {
			enum = action.Enum
		}

		tools[tl.Spec().Name] = enum
	}

	refs := regexp.MustCompile(`\b([a-z_]+) action ([a-z_]+)`).FindAllStringSubmatch(assistant.Instructions(), -1)
	if len(refs) == 0 {
		t.Fatal("the guide names no tool action")
	}

	for _, ref := range refs {
		enum, ok := tools[ref[1]]
		if !ok {
			t.Errorf("the guide names tool %s, which the catalog does not hold", ref[1])
			continue
		}

		if !slices.Contains(enum, any(ref[2])) {
			t.Errorf("the guide names %s action %s, which is not in its action enum %v", ref[1], ref[2], enum)
		}
	}
}
