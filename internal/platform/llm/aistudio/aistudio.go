// Package aistudio calls the Gemini API of Google AI Studio through its generateContent method.
package aistudio

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/andrelopes-code/equori/internal/platform/llm"
)

const name = "aistudio"

type Provider struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

// New returns the provider for the Gemini API at baseURL, the only address it contacts (N17).
func New(baseURL, apiKey string, client *http.Client) *Provider {
	return &Provider{baseURL: strings.TrimSuffix(baseURL, "/"), apiKey: apiKey, client: client}
}

func (p *Provider) Name() string { return name }

func (p *Provider) Generate(ctx context.Context, model string, req llm.Request) (llm.Response, error) {
	resp, err := p.post(ctx, model, ":generateContent", req)
	if err != nil {
		return llm.Response{}, err
	}
	defer resp.Body.Close()
	var wire generateResponse
	if err := json.NewDecoder(resp.Body).Decode(&wire); err != nil {
		return llm.Response{}, fmt.Errorf("aistudio %s: decode response: %w", model, err)
	}
	return fromWire(wire), nil
}

// Stream calls streamGenerateContent and merges its chunks into the response Generate would
// return. A stream that ends before a chunk names its finish reason is a transient failure.
func (p *Provider) Stream(ctx context.Context, model string, req llm.Request, onText func(string)) (llm.Response, error) {
	resp, err := p.post(ctx, model, ":streamGenerateContent?alt=sse", req)
	if err != nil {
		return llm.Response{}, err
	}
	defer resp.Body.Close()
	var merged generateResponse
	var parts []part
	finish := ""
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64<<10), 1<<20)
	for scanner.Scan() {
		data, ok := strings.CutPrefix(strings.TrimSpace(scanner.Text()), "data:")
		if !ok {
			continue
		}
		var chunk generateResponse
		if err := json.Unmarshal([]byte(strings.TrimSpace(data)), &chunk); err != nil {
			return llm.Response{}, fmt.Errorf("aistudio %s: decode chunk: %w", model, err)
		}
		if chunk.UsageMetadata.PromptTokenCount > 0 || chunk.UsageMetadata.CandidatesTokenCount > 0 {
			merged.UsageMetadata = chunk.UsageMetadata
		}
		if chunk.PromptFeedback != nil {
			merged.PromptFeedback = chunk.PromptFeedback
		}
		if len(chunk.Candidates) == 0 {
			continue
		}
		c := chunk.Candidates[0]
		if c.FinishReason != "" {
			finish = c.FinishReason
		}
		if c.Content == nil {
			continue
		}
		for _, np := range c.Content.Parts {
			if np.Thought {
				continue
			}
			if np.Text != nil && *np.Text != "" {
				onText(*np.Text)
			}
			parts = mergePart(parts, np)
		}
	}
	if err := scanner.Err(); err != nil {
		if ctx.Err() != nil {
			return llm.Response{}, fmt.Errorf("aistudio %s: %w", model, ctx.Err())
		}
		return llm.Response{}, fmt.Errorf("aistudio %s: read stream: %w: %w", model, llm.ErrTransient, err)
	}
	if merged.PromptFeedback != nil && merged.PromptFeedback.BlockReason != "" && len(parts) == 0 {
		return fromWire(merged), nil
	}
	if finish == "" {
		return llm.Response{}, fmt.Errorf("aistudio %s: stream ended without a finish reason: %w", model, llm.ErrTransient)
	}
	merged.Candidates = []candidate{{Content: &content{Role: "model", Parts: parts}, FinishReason: finish}}
	return fromWire(merged), nil
}

// mergePart joins a text part to a preceding text part without a signature, moving its signature
// onto the joined part; any other part is appended.
func mergePart(parts []part, np part) []part {
	if np.Text != nil && len(parts) > 0 {
		last := &parts[len(parts)-1]
		if last.Text != nil && len(last.ThoughtSignature) == 0 {
			joined := *last.Text + *np.Text
			last.Text = &joined
			last.ThoughtSignature = np.ThoughtSignature
			return parts
		}
	}
	return append(parts, np)
}

// post sends req to the model's method and returns a 200 response, whose body the caller closes.
func (p *Provider) post(ctx context.Context, model, method string, req llm.Request) (*http.Response, error) {
	body, err := json.Marshal(toWire(req))
	if err != nil {
		return nil, fmt.Errorf("encode request: %w", err)
	}
	endpoint := p.baseURL + "/v1beta/models/" + url.PathEscape(model) + method
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	// The key goes in a header: a URL ends up in *url.Error strings and logs (N16).
	httpReq.Header.Set("x-goog-api-key", p.apiKey)
	resp, err := p.client.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil {
			return nil, fmt.Errorf("aistudio %s: %w", model, ctx.Err())
		}
		return nil, fmt.Errorf("aistudio %s: %w: %w", model, llm.ErrTransient, err)
	}
	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
		return nil, statusError(model, resp.StatusCode, errBody)
	}
	return resp, nil
}

// Models returns the IDs of the models that serve generateContent, sorted.
func (p *Provider) Models(ctx context.Context) ([]string, error) {
	// pageSize 1000 is the API maximum, above the number of listed models.
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, p.baseURL+"/v1beta/models?pageSize=1000", nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	httpReq.Header.Set("x-goog-api-key", p.apiKey)
	resp, err := p.client.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil {
			return nil, fmt.Errorf("aistudio models: %w", ctx.Err())
		}
		return nil, fmt.Errorf("aistudio models: %w: %w", llm.ErrTransient, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
		return nil, statusError("models", resp.StatusCode, errBody)
	}
	var wire struct {
		Models []struct {
			Name    string   `json:"name"`
			Methods []string `json:"supportedGenerationMethods"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&wire); err != nil {
		return nil, fmt.Errorf("aistudio models: decode response: %w", err)
	}
	var ids []string
	for _, m := range wire.Models {
		if slices.Contains(m.Methods, "generateContent") {
			ids = append(ids, strings.TrimPrefix(m.Name, "models/"))
		}
	}
	slices.Sort(ids)
	return ids, nil
}

func toWire(req llm.Request) generateRequest {
	w := generateRequest{Contents: []content{}}
	if req.System != "" {
		s := req.System
		w.SystemInstruction = &content{Parts: []part{{Text: &s}}}
	}
	for _, m := range req.Messages {
		role := "user"
		if m.Role == llm.RoleModel {
			role = "model"
		}
		c := content{Role: role, Parts: []part{}}
		for _, p := range m.Parts {
			c.Parts = append(c.Parts, partToWire(p))
		}
		w.Contents = append(w.Contents, c)
	}
	if len(req.Tools) > 0 {
		var decls []functionDeclaration
		for _, t := range req.Tools {
			decls = append(decls, functionDeclaration{Name: t.Name, Description: t.Description, ParametersJSONSchema: t.Parameters})
		}
		w.Tools = []tool{{FunctionDeclarations: decls}}
		if req.ToolChoice == llm.ToolChoiceNone {
			w.ToolConfig = &toolConfig{}
			w.ToolConfig.FunctionCallingConfig.Mode = "NONE"
		}
	}
	if req.Schema != nil || req.MaxOutputTokens > 0 || req.Temperature != nil || req.Thinking != "" {
		cfg := &generationConfig{MaxOutputTokens: req.MaxOutputTokens, Temperature: req.Temperature}
		if req.Schema != nil {
			cfg.ResponseMimeType, cfg.ResponseJSONSchema = "application/json", req.Schema
		}
		if req.Thinking == "low" {
			cfg.ThinkingConfig = &thinkingConfig{ThinkingLevel: "LOW"}
		}
		w.GenerationConfig = cfg
	}
	return w
}

func partToWire(p llm.Part) part {
	var w part
	switch {
	case p.ToolCall != nil:
		w.FunctionCall = &functionCall{ID: p.ToolCall.ID, Name: p.ToolCall.Name, Args: p.ToolCall.Args}
	case p.ToolResult != nil:
		w.FunctionResponse = &functionResponse{ID: p.ToolResult.CallID, Name: p.ToolResult.Name, Response: asObject(p.ToolResult.Content)}
	default:
		t := p.Text
		w.Text = &t
	}
	if p.Signature != nil && p.Signature.Provider == name {
		w.ThoughtSignature = p.Signature.Data
	}
	return w
}

// asObject wraps content that is not a JSON object, because functionResponse.response must
// be one.
func asObject(content json.RawMessage) json.RawMessage {
	trimmed := bytes.TrimSpace(content)
	if len(trimmed) > 0 && trimmed[0] == '{' {
		return content
	}
	if len(trimmed) == 0 {
		trimmed = []byte("null")
	}
	b, _ := json.Marshal(map[string]json.RawMessage{"result": trimmed})
	return b
}

func fromWire(w generateResponse) llm.Response {
	resp := llm.Response{
		Message: llm.Message{Role: llm.RoleModel},
		Usage: llm.Usage{
			InputTokens:  w.UsageMetadata.PromptTokenCount,
			OutputTokens: w.UsageMetadata.CandidatesTokenCount + w.UsageMetadata.ThoughtsTokenCount,
		},
	}
	if len(w.Candidates) == 0 {
		resp.FinishReason = llm.FinishOther
		if w.PromptFeedback != nil && w.PromptFeedback.BlockReason != "" {
			resp.FinishReason = llm.FinishBlocked
		}
		return resp
	}
	c := w.Candidates[0]
	hasCall := false
	if c.Content != nil {
		for _, p := range c.Content.Parts {
			if p.Thought {
				continue
			}
			var np llm.Part
			switch {
			case p.FunctionCall != nil:
				np.ToolCall = &llm.ToolCall{ID: p.FunctionCall.ID, Name: p.FunctionCall.Name, Args: p.FunctionCall.Args}
				hasCall = true
			case p.Text != nil:
				np.Text = *p.Text
			}
			if len(p.ThoughtSignature) > 0 {
				np.Signature = &llm.Signature{Provider: name, Data: p.ThoughtSignature}
			}
			resp.Message.Parts = append(resp.Message.Parts, np)
		}
	}
	resp.FinishReason = finishReason(c.FinishReason, hasCall)
	return resp
}

func finishReason(reason string, hasCall bool) llm.FinishReason {
	switch reason {
	case "STOP", "":
		if hasCall {
			return llm.FinishToolCalls
		}
		if reason == "" {
			return llm.FinishOther
		}
		return llm.FinishStop
	case "MAX_TOKENS":
		return llm.FinishLength
	case "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII":
		return llm.FinishBlocked
	default:
		return llm.FinishOther
	}
}
