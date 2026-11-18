package anthropic

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/andrelopes-code/equori/internal/platform/llm"
)

// defaultMaxTokens is sent when the request sets no limit: the API requires max_tokens, and
// reasoning counts toward it.
const defaultMaxTokens = 16000

const (
	blockText             = "text"
	blockToolUse          = "tool_use"
	blockToolResult       = "tool_result"
	blockThinking         = "thinking"
	blockRedactedThinking = "redacted_thinking"
)

type messagesRequest struct {
	Model        string        `json:"model"`
	MaxTokens    int           `json:"max_tokens"`
	System       string        `json:"system,omitempty"`
	Messages     []message     `json:"messages"`
	Tools        []tool        `json:"tools,omitempty"`
	ToolChoice   *toolChoice   `json:"tool_choice,omitempty"`
	OutputConfig *outputConfig `json:"output_config,omitempty"`
	// CacheControl at the top level caches the prefix up to the last block of the request, so
	// each step of a tool loop reads the previous step's prompt at the cache price.
	CacheControl cacheControl `json:"cache_control"`
	Stream       bool         `json:"stream,omitempty"`
}

// message holds content blocks: a textBlock, a toolUseBlock, a toolResultBlock, or the raw
// JSON of a thinking block an earlier answer returned.
type message struct {
	Role    string `json:"role"`
	Content []any  `json:"content"`
}

type textBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// fileBlock is an image block or a document block of a file the user part carries.
type fileBlock struct {
	Type   string     `json:"type"`
	Source fileSource `json:"source"`
}

// fileSource holds base64 data, or the text itself for a plain text document.
type fileSource struct {
	Type      string `json:"type"`
	MediaType string `json:"media_type"`
	Data      string `json:"data"`
}

type toolUseBlock struct {
	Type  string          `json:"type"`
	ID    string          `json:"id"`
	Name  string          `json:"name"`
	Input json.RawMessage `json:"input"`
}

type toolResultBlock struct {
	Type      string `json:"type"`
	ToolUseID string `json:"tool_use_id"`
	Content   string `json:"content"`
	IsError   bool   `json:"is_error,omitempty"`
}

type tool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"input_schema"`
}

type toolChoice struct {
	Type string `json:"type"`
}

type outputConfig struct {
	Effort string        `json:"effort,omitempty"`
	Format *outputFormat `json:"format,omitempty"`
}

type outputFormat struct {
	Type   string          `json:"type"`
	Schema json.RawMessage `json:"schema"`
}

type cacheControl struct {
	Type string `json:"type"`
}

type messagesResponse struct {
	Content    []json.RawMessage `json:"content"`
	StopReason string            `json:"stop_reason"`
	Usage      usage             `json:"usage"`
}

// contentBlock is the part of an answer's block this adapter reads.
type contentBlock struct {
	Type  string          `json:"type"`
	Text  string          `json:"text"`
	ID    string          `json:"id"`
	Name  string          `json:"name"`
	Input json.RawMessage `json:"input"`
}

// usage splits the prompt by price: InputTokens is only the part read at full price.
type usage struct {
	InputTokens              int `json:"input_tokens"`
	CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
	CacheReadInputTokens     int `json:"cache_read_input_tokens"`
	OutputTokens             int `json:"output_tokens"`
}

type modelList struct {
	Data []struct {
		ID string `json:"id"`
	} `json:"data"`
}

// toWire leaves Temperature out: current models reject a sampling value other than their
// default.
func toWire(model string, req llm.Request) messagesRequest {
	w := messagesRequest{
		Model:        model,
		MaxTokens:    defaultMaxTokens,
		System:       req.System,
		OutputConfig: outputConfigToWire(req),
		CacheControl: cacheControl{Type: "ephemeral"},
	}
	if req.MaxOutputTokens > 0 {
		w.MaxTokens = req.MaxOutputTokens
	}

	for _, m := range req.Messages {
		if content := contentToWire(m); len(content) > 0 {
			w.Messages = append(w.Messages, message{Role: roleToWire(m.Role), Content: content})
		}
	}

	for _, t := range req.Tools {
		schema := t.Parameters
		if len(schema) == 0 {
			schema = json.RawMessage(`{"type":"object"}`)
		}

		w.Tools = append(
			w.Tools,
			tool{Name: t.Name, Description: t.Description, InputSchema: schema},
		)
	}

	if len(w.Tools) > 0 && req.ToolChoice == llm.ToolChoiceNone {
		w.ToolChoice = &toolChoice{Type: "none"}
	}

	return w
}

func outputConfigToWire(req llm.Request) *outputConfig {
	if req.Thinking == "" && req.Schema == nil {
		return nil
	}

	cfg := &outputConfig{Effort: req.Thinking}
	if req.Schema != nil {
		cfg.Format = &outputFormat{Type: "json_schema", Schema: req.Schema}
	}

	return cfg
}

// roleToWire maps tool results to the user role, where the API carries them.
func roleToWire(r llm.Role) string {
	if r == llm.RoleModel {
		return "assistant"
	}

	return "user"
}

// contentToWire sends a thinking block back as it arrived, since the API validates it, and
// drops the signatures of other providers and empty texts, which the API rejects.
func contentToWire(m llm.Message) []any {
	var out []any
	for _, p := range m.Parts {
		switch {
		case p.ToolCall != nil:
			input := p.ToolCall.Args
			if len(input) == 0 {
				input = json.RawMessage(`{}`)
			}

			out = append(
				out,
				toolUseBlock{
					Type:  blockToolUse,
					ID:    p.ToolCall.ID,
					Name:  p.ToolCall.Name,
					Input: input,
				},
			)
		case p.ToolResult != nil:
			out = append(out, toolResultBlock{
				Type:      blockToolResult,
				ToolUseID: p.ToolResult.CallID,
				Content:   string(p.ToolResult.Content),
				IsError:   p.ToolResult.IsError,
			})
		case p.File != nil:
			out = append(out, fileToWire(*p.File))
		case p.Signature != nil && p.Signature.Provider == name:
			out = append(out, json.RawMessage(p.Signature.Data))
		case p.Text != "":
			out = append(out, textBlock{Type: blockText, Text: p.Text})
		}
	}

	return out
}

// fromWire reports the whole prompt as input tokens, whatever price each part was read at.
func fromWire(w messagesResponse) llm.Response {
	resp := llm.Response{
		Message: llm.Message{Role: llm.RoleModel},
		Usage: llm.Usage{
			InputTokens: w.Usage.InputTokens +
				w.Usage.CacheCreationInputTokens +
				w.Usage.CacheReadInputTokens,
			OutputTokens: w.Usage.OutputTokens,
		},
	}

	hasCall := false

	for _, raw := range w.Content {
		var b contentBlock
		if err := json.Unmarshal(raw, &b); err != nil {
			continue
		}

		if part, ok := partFromWire(b, raw); ok {
			hasCall = hasCall || part.ToolCall != nil
			resp.Message.Parts = append(resp.Message.Parts, part)
		}
	}

	resp.FinishReason = finishReason(w.StopReason, hasCall)

	return resp
}

// partFromWire keeps a thinking block whole as a signature; ok is false for a block that
// carries nothing for the caller.
func partFromWire(b contentBlock, raw json.RawMessage) (llm.Part, bool) {
	switch b.Type {
	case blockText:
		return llm.Part{Text: b.Text}, b.Text != ""
	case blockToolUse:
		args := b.Input
		if len(args) == 0 {
			args = json.RawMessage(`{}`)
		}

		return llm.Part{ToolCall: &llm.ToolCall{ID: b.ID, Name: b.Name, Args: args}}, true
	case blockThinking, blockRedactedThinking:
		return llm.Part{Signature: &llm.Signature{Provider: name, Data: raw}}, true
	default:
		return llm.Part{}, false
	}
}

func finishReason(reason string, hasCall bool) llm.FinishReason {
	switch {
	case hasCall:
		return llm.FinishToolCalls
	case reason == "end_turn" || reason == "stop_sequence":
		return llm.FinishStop
	case reason == "max_tokens":
		return llm.FinishLength
	case reason == "refusal":
		return llm.FinishBlocked
	default:
		return llm.FinishOther
	}
}

// fileKinds maps the media types the Messages API reads to the block that carries them.
var fileKinds = map[string]string{
	"image/jpeg":      "image",
	"image/png":       "image",
	"image/webp":      "image",
	"image/gif":       "image",
	"application/pdf": "document",
	"text/plain":      "document",
}

// checkFiles refuses a request whose file the Messages API does not read, before the call.
func checkFiles(req llm.Request) error {
	for _, m := range req.Messages {
		for _, p := range m.Parts {
			if p.File != nil && fileKinds[p.File.MediaType] == "" {
				return fmt.Errorf("%w: %s", llm.ErrFileUnsupported, p.File.MediaType)
			}
		}
	}

	return nil
}

func fileToWire(f llm.File) fileBlock {
	if f.MediaType == "text/plain" {
		return fileBlock{
			Type:   "document",
			Source: fileSource{Type: "text", MediaType: f.MediaType, Data: string(f.Data)},
		}
	}

	return fileBlock{
		Type: fileKinds[f.MediaType],
		Source: fileSource{
			Type:      "base64",
			MediaType: f.MediaType,
			Data:      base64.StdEncoding.EncodeToString(f.Data),
		},
	}
}
