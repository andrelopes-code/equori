// Package llm sends language model requests through provider-neutral chains (ADR 009).
package llm

import "encoding/json"

type Role string

const (
	RoleUser  Role = "user"
	RoleModel Role = "model"
	RoleTool  Role = "tool"
)

type Message struct {
	Role  Role
	Parts []Part
}

// Part is a tool call when ToolCall is set, a tool result when ToolResult is set, and text
// otherwise. A text part may be empty and carry only a Signature.
type Part struct {
	Text       string
	ToolCall   *ToolCall
	ToolResult *ToolResult
	Signature  *Signature
}

type ToolCall struct {
	ID   string
	Name string
	Args json.RawMessage
}

type ToolResult struct {
	CallID  string
	Name    string
	Content json.RawMessage
	IsError bool
}

// Signature is opaque provider state attached to a part. It must travel back unchanged in
// later requests; adapters send only their own provider's signatures.
type Signature struct {
	Provider string
	Data     []byte
}
