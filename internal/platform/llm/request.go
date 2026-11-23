package llm

import "encoding/json"

type Request struct {
	System   string
	Messages []Message
	Tools    []Tool
	// Schema is a JSON Schema the answer must follow; nil asks for free text. Every object in it
	// sets additionalProperties to false: the Anthropic API refuses the request otherwise.
	Schema json.RawMessage
	// MaxOutputTokens of 0 leaves the provider default. Reasoning counts toward the limit.
	MaxOutputTokens int
	Temperature     *float64
	// ToolChoice of ToolChoiceNone forbids tool calls while Tools stay declared.
	ToolChoice ToolChoice
	// Pin restricts Client.Generate to one target; the zero value allows any target.
	Pin Target
	// Thinking is "" for the model's default reasoning depth or "low" (design 2026-10-26 E14).
	Thinking string
	// WebSearch asks for the search the provider runs on its own servers (web search design,
	// S1). Client keeps it only for a target that holds CapWebSearch; an adapter without a
	// search ignores it.
	WebSearch bool
}

// HasFiles reports whether a message of the request carries a file part.
func (r Request) HasFiles() bool {
	for _, m := range r.Messages {
		for _, p := range m.Parts {
			if p.File != nil {
				return true
			}
		}
	}

	return false
}

type ToolChoice string

const (
	ToolChoiceAuto ToolChoice = ""
	ToolChoiceNone ToolChoice = "none"
)

type Tool struct {
	Name        string
	Description string
	// Parameters is a JSON Schema describing an object whose properties are the arguments.
	Parameters json.RawMessage
}
