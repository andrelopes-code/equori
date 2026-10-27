package llm

import (
	"encoding/json"
	"strings"
)

type Request struct {
	System   string
	Messages []Message
	Tools    []Tool
	// Schema is a JSON Schema the answer must follow; nil asks for free text.
	Schema json.RawMessage
	// MaxOutputTokens of 0 leaves the provider default.
	MaxOutputTokens int
	Temperature     *float64
	// ToolChoice of ToolChoiceNone forbids tool calls while Tools stay declared.
	ToolChoice ToolChoice
	// Pin restricts Client.Generate to one target; the zero value allows any target.
	Pin Target
	// Thinking is "" for the model's default reasoning depth or "low" (design 2026-10-26 E14).
	Thinking string
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

type FinishReason string

const (
	FinishStop      FinishReason = "stop"
	FinishLength    FinishReason = "length"
	FinishToolCalls FinishReason = "tool_calls"
	FinishBlocked   FinishReason = "blocked"
	FinishOther     FinishReason = "other"
)

type Usage struct {
	InputTokens  int
	OutputTokens int
}

type Response struct {
	Message      Message
	FinishReason FinishReason
	Usage        Usage
	// Target is the model that answered, set by Client.
	Target Target
}

// Text concatenates the text parts of the answer.
func (r Response) Text() string {
	var b strings.Builder
	for _, p := range r.Message.Parts {
		if p.ToolCall == nil && p.ToolResult == nil {
			b.WriteString(p.Text)
		}
	}
	return b.String()
}

// Target is one model of one provider.
type Target struct {
	Provider string
	Model    string
}

func (t Target) String() string { return t.Provider + "/" + t.Model }
