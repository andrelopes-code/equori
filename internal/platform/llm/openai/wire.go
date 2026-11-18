package openai

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
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
	Stream         bool            `json:"stream,omitempty"`
	StreamOptions  *streamOptions  `json:"stream_options,omitempty"`
}

type streamOptions struct {
	IncludeUsage bool `json:"include_usage"`
}

// message keeps content without omitempty: an assistant turn with only tool calls sends
// "content": null, which every compatible API accepts.
type message struct {
	Role       string     `json:"role"`
	Content    *string    `json:"content"`
	ToolCalls  []toolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	// Parts replaces Content with a list of parts when the message carries a file (F6).
	Parts []contentPart `json:"-"`
}

// contentPart is a text, an image as a data URL, or a PDF as a file with a data URL.
type contentPart struct {
	Type     string    `json:"type"`
	Text     string    `json:"text,omitempty"`
	ImageURL *imageURL `json:"image_url,omitempty"`
	File     *filePart `json:"file,omitempty"`
}

type imageURL struct {
	URL string `json:"url"`
}

type filePart struct {
	Filename string `json:"filename"`
	FileData string `json:"file_data"`
}

// MarshalJSON writes Parts as the content when the message has them.
func (m message) MarshalJSON() ([]byte, error) {
	type plain message

	if len(m.Parts) == 0 {
		return json.Marshal(plain(m))
	}

	return json.Marshal(struct {
		plain
		Content []contentPart `json:"content"`
	}{plain: plain(m), Content: m.Parts})
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
	Choices []choice `json:"choices"`
	Usage   usage    `json:"usage"`
}

type choice struct {
	Message      message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

type usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
}

// chatChunk is one server-sent event of a streamed chat completion.
type chatChunk struct {
	Choices []struct {
		Delta struct {
			Content   string `json:"content"`
			ToolCalls []struct {
				Index    int      `json:"index"`
				ID       string   `json:"id"`
				Function function `json:"function"`
			} `json:"tool_calls"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage *usage `json:"usage"`
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
		w.Tools = append(
			w.Tools,
			tool{
				Type: "function",
				Function: functionDef{
					Name:        t.Name,
					Description: t.Description,
					Parameters:  t.Parameters,
				},
			},
		)
	}

	if len(w.Tools) > 0 && req.ToolChoice == llm.ToolChoiceNone {
		w.ToolChoice = "none"
	}

	if req.Schema != nil {
		w.ResponseFormat = &responseFormat{
			Type:       "json_schema",
			JSONSchema: jsonSchema{Name: "answer", Schema: req.Schema},
		}
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
				out = append(
					out,
					message{Role: "tool", Content: &content, ToolCallID: p.ToolResult.CallID},
				)
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
		case p.File != nil:
			w.Parts = append(w.Parts, fileToWire(*p.File))
		case p.ToolResult == nil:
			text.WriteString(p.Text)
		}
	}

	s := text.String()
	if s != "" || len(w.ToolCalls) == 0 {
		w.Content = &s
	}

	if len(w.Parts) > 0 && s != "" {
		w.Parts = append([]contentPart{{Type: "text", Text: s}}, w.Parts...)
	}

	return []message{w}
}

func fromWire(w chatResponse) llm.Response {
	resp := llm.Response{
		Message: llm.Message{Role: llm.RoleModel},
		Usage: llm.Usage{
			InputTokens:  w.Usage.PromptTokens,
			OutputTokens: w.Usage.CompletionTokens,
		},
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

		resp.Message.Parts = append(
			resp.Message.Parts,
			llm.Part{ToolCall: &llm.ToolCall{ID: tc.ID, Name: tc.Function.Name, Args: args}},
		)
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

// checkFiles refuses a request whose file the chat completions API does not read, before the
// call.
func checkFiles(req llm.Request) error {
	for _, m := range req.Messages {
		for _, p := range m.Parts {
			if p.File == nil {
				continue
			}

			switch t := p.File.MediaType; {
			case t == "application/pdf", t == "text/plain", strings.HasPrefix(t, "image/"):
			default:
				return fmt.Errorf("%w: %s", llm.ErrFileUnsupported, t)
			}
		}
	}

	return nil
}

func fileToWire(f llm.File) contentPart {
	data := "data:" + f.MediaType + ";base64," + base64.StdEncoding.EncodeToString(f.Data)

	switch f.MediaType {
	case "text/plain":
		return contentPart{Type: "text", Text: string(f.Data)}
	case "application/pdf":
		return contentPart{Type: "file", File: &filePart{Filename: "file.pdf", FileData: data}}
	}

	return contentPart{Type: "image_url", ImageURL: &imageURL{URL: data}}
}
