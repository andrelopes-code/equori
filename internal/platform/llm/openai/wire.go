package openai

import (
	"encoding/json"
	"strings"

	"github.com/andrelopes-code/equori/internal/platform/llm"
)

type chatRequest struct {
	Model          string          `json:"model"`
	Messages       []message       `json:"messages"`
	Tools          []tool          `json:"tools,omitempty"`
	ToolChoice     string          `json:"tool_choice,omitempty"`
	ResponseFormat *responseFormat `json:"response_format,omitempty"`
	MaxTokens      int             `json:"max_tokens,omitzero"`
	Temperature    *float64        `json:"temperature,omitempty"`
}

// message keeps content without omitempty: an assistant turn with only tool calls sends
// "content": null, which every compatible API accepts.
type message struct {
	Role       string     `json:"role"`
	Content    *string    `json:"content"`
	ToolCalls  []toolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
}

type toolCall struct {
	ID       string   `json:"id"`
	Type     string   `json:"type"`
	Function function `json:"function"`
}

type function struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type tool struct {
	Type     string      `json:"type"`
	Function functionDef `json:"function"`
}

type functionDef struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

type responseFormat struct {
	Type       string     `json:"type"`
	JSONSchema jsonSchema `json:"json_schema"`
}

type jsonSchema struct {
	Name   string          `json:"name"`
	Schema json.RawMessage `json:"schema"`
}

type chatResponse struct {
	Choices []struct {
		Message      message `json:"message"`
		FinishReason string  `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
}

type modelList struct {
	Data []struct {
		ID string `json:"id"`
	} `json:"data"`
}

func toWire(model string, req llm.Request) chatRequest {
	w := chatRequest{Model: model, MaxTokens: req.MaxOutputTokens, Temperature: req.Temperature}
	if req.System != "" {
		w.Messages = append(w.Messages, message{Role: "system", Content: &req.System})
	}
	for _, m := range req.Messages {
		w.Messages = append(w.Messages, messagesToWire(m)...)
	}
	for _, t := range req.Tools {
		w.Tools = append(w.Tools, tool{Type: "function", Function: functionDef{Name: t.Name, Description: t.Description, Parameters: t.Parameters}})
	}
	if len(w.Tools) > 0 && req.ToolChoice == llm.ToolChoiceNone {
		w.ToolChoice = "none"
	}
	if req.Schema != nil {
		w.ResponseFormat = &responseFormat{Type: "json_schema", JSONSchema: jsonSchema{Name: "answer", Schema: req.Schema}}
	}
	return w
}

// messagesToWire returns one message per tool result, since the API carries one result per
// tool message; other roles map to a single message.
func messagesToWire(m llm.Message) []message {
	if m.Role == llm.RoleTool {
		var out []message
		for _, p := range m.Parts {
			if p.ToolResult != nil {
				content := string(p.ToolResult.Content)
				out = append(out, message{Role: "tool", Content: &content, ToolCallID: p.ToolResult.CallID})
			}
		}
		return out
	}
	role := "user"
	if m.Role == llm.RoleModel {
		role = "assistant"
	}
	w := message{Role: role}
	var text strings.Builder
	for _, p := range m.Parts {
		switch {
		case p.ToolCall != nil:
			w.ToolCalls = append(w.ToolCalls, toolCall{ID: p.ToolCall.ID, Type: "function",
				Function: function{Name: p.ToolCall.Name, Arguments: string(p.ToolCall.Args)}})
		case p.ToolResult == nil:
			text.WriteString(p.Text)
		}
	}
	if s := text.String(); s != "" || len(w.ToolCalls) == 0 {
		w.Content = &s
	}
	return []message{w}
}

func fromWire(w chatResponse) llm.Response {
	resp := llm.Response{
		Message: llm.Message{Role: llm.RoleModel},
		Usage:   llm.Usage{InputTokens: w.Usage.PromptTokens, OutputTokens: w.Usage.CompletionTokens},
	}
	if len(w.Choices) == 0 {
		resp.FinishReason = llm.FinishOther
		return resp
	}
	c := w.Choices[0]
	if c.Message.Content != nil && *c.Message.Content != "" {
		resp.Message.Parts = append(resp.Message.Parts, llm.Part{Text: *c.Message.Content})
	}
	for _, tc := range c.Message.ToolCalls {
		args := json.RawMessage(tc.Function.Arguments)
		if len(args) == 0 {
			args = json.RawMessage(`{}`)
		}
		resp.Message.Parts = append(resp.Message.Parts, llm.Part{ToolCall: &llm.ToolCall{ID: tc.ID, Name: tc.Function.Name, Args: args}})
	}
	resp.FinishReason = finishReason(c.FinishReason, len(c.Message.ToolCalls) > 0)
	return resp
}

func finishReason(reason string, hasCall bool) llm.FinishReason {
	switch {
	case hasCall:
		return llm.FinishToolCalls
	case reason == "stop":
		return llm.FinishStop
	case reason == "length":
		return llm.FinishLength
	case reason == "content_filter":
		return llm.FinishBlocked
	default:
		return llm.FinishOther
	}
}
