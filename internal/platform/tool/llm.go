package tool

import (
	"context"
	"encoding/json"

	"github.com/andrelopes-code/equori/internal/platform/llm"
)

// LLM returns the declarations and handlers llm.RunTools takes (ADR 012 T10).
func (s Set) LLM() ([]llm.Tool, map[string]llm.ToolHandler) {
	tools := make([]llm.Tool, 0, len(s.names))
	handlers := make(map[string]llm.ToolHandler, len(s.names))
	for _, t := range s.Tools() {
		params, err := json.Marshal(t.input)
		if err != nil {
			// New marshalled the same schema when it checked the keywords.
			panic(err)
		}
		name := t.spec.Name
		tools = append(tools, llm.Tool{Name: name, Description: t.spec.Description, Parameters: params})
		handlers[name] = func(ctx context.Context, args json.RawMessage) (json.RawMessage, error) {
			res, err := s.Call(ctx, name, args)
			if err != nil {
				return nil, err
			}
			if res.IsError {
				return nil, &llm.ToolError{Content: res.Content}
			}
			return res.Content, nil
		}
	}
	return tools, handlers
}
