package tool

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"

	"github.com/andrelopes-code/equori/internal/platform/llm"
)

// Set is the part of a registry one consumer may call.
type Set struct {
	r     *Registry
	names []string
}

func (s Set) Tools() []Tool {
	out := make([]Tool, len(s.names))
	for i, n := range s.names {
		out[i] = s.r.entries[n].tool
	}

	return out
}

func (s Set) Call(ctx context.Context, name string, args json.RawMessage) (Result, error) {
	if !slices.Contains(s.names, name) {
		return Result{}, fmt.Errorf("call tool %s: %w", name, ErrUnknownTool)
	}

	return s.r.Call(ctx, name, args)
}

// Validate checks args against the input schema of a tool of the set, like Call, without
// running it.
func (s Set) Validate(name string, args json.RawMessage) (Result, error) {
	if !slices.Contains(s.names, name) {
		return Result{}, fmt.Errorf("validate tool %s: %w", name, ErrUnknownTool)
	}

	if _, bad := s.r.entries[name].tool.validate(args); bad != nil {
		res, _, err := failure(*bad)
		return res, err
	}

	return Result{}, nil
}

// Preview checks membership like Call.
func (s Set) Preview(
	ctx context.Context,
	name string,
	args json.RawMessage,
) (Preview, Result, error) {
	if !slices.Contains(s.names, name) {
		return Preview{}, Result{}, fmt.Errorf("preview tool %s: %w", name, ErrUnknownTool)
	}

	return s.r.Preview(ctx, name, args)
}

// LLM returns the declarations and handlers llm.RunTools takes (ADR 012 T10).
func (s Set) LLM() ([]llm.Tool, map[string]llm.ToolHandler) {
	tools := make([]llm.Tool, 0, len(s.names))

	handlers := make(map[string]llm.ToolHandler, len(s.names))
	for _, t := range s.Tools() {
		name := t.spec.Name
		tools = append(tools, llm.Tool{
			Name:        name,
			Description: t.spec.Description,
			Parameters:  t.input.json,
		})
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
