package tool

import (
	"encoding/json"
	"fmt"
	"slices"
)

// Undo is the write that reverses an executed call: a tool of the same registry and its arguments.
type Undo struct {
	Tool      string
	Arguments json.RawMessage
}

// WithUndo returns t with the derivation of the write that reverses one of its calls. undo gets
// the arguments and the result of the call and the reason the user gives, and returns the inverse
// tool with its arguments, or false when that call has no exact inverse.
func WithUndo[In, Out any](
	t Tool,
	undo func(in In, out Out, reason string) (string, any, bool),
) Tool {
	t.undo = func(args, result []byte, reason string) (Undo, bool) {
		var in In
		if json.Unmarshal(args, &in) != nil {
			return Undo{}, false
		}

		var out Out
		if json.Unmarshal(result, &out) != nil {
			return Undo{}, false
		}

		name, inverse, ok := undo(in, out, reason)
		if !ok {
			return Undo{}, false
		}

		b, err := json.Marshal(inverse)
		if err != nil {
			return Undo{}, false
		}

		return Undo{Tool: name, Arguments: b}, true
	}

	return t
}

// Undo returns the write that reverses a call of a tool of the set with args and result; false
// when the call has no inverse, or its inverse is not in the set.
func (s Set) Undo(name string, args, result json.RawMessage, reason string) (Undo, bool, error) {
	if !slices.Contains(s.names, name) {
		return Undo{}, false, fmt.Errorf("undo tool %s: %w", name, ErrUnknownTool)
	}

	t := s.r.entries[name].tool
	if t.undo == nil {
		return Undo{}, false, nil
	}

	u, ok := t.undo(args, result, reason)
	if !ok || !slices.Contains(s.names, u.Tool) {
		return Undo{}, false, nil
	}

	return u, true, nil
}
