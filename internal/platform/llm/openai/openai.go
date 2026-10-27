// Package openai calls any API that implements the OpenAI chat completions method.
package openai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"

	"github.com/andrelopes-code/equori/internal/platform/llm"
)

const name = "openai"

type Provider struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

// New returns the provider for the API at baseURL, the only address it contacts (N17). An
// empty apiKey sends no Authorization header, as local servers expect.
func New(baseURL, apiKey string, client *http.Client) *Provider {
	return &Provider{baseURL: strings.TrimSuffix(baseURL, "/"), apiKey: apiKey, client: client}
}

func (p *Provider) Name() string { return name }

func (p *Provider) Generate(ctx context.Context, model string, req llm.Request) (llm.Response, error) {
	body, err := json.Marshal(toWire(model, req))
	if err != nil {
		return llm.Response{}, fmt.Errorf("encode request: %w", err)
	}
	var wire chatResponse
	if err := p.do(ctx, http.MethodPost, "/chat/completions", model, body, decodeInto(model, &wire)); err != nil {
		return llm.Response{}, err
	}
	return fromWire(wire), nil
}

// Stream asks for a streamed completion with a final usage chunk and accumulates its deltas,
// tool calls by index, into the response Generate would return. A stream that ends before a
// chunk names its finish reason is a transient failure.
func (p *Provider) Stream(ctx context.Context, model string, req llm.Request, onText func(string)) (llm.Response, error) {
	w := toWire(model, req)
	w.Stream, w.StreamOptions = true, &streamOptions{IncludeUsage: true}
	body, err := json.Marshal(w)
	if err != nil {
		return llm.Response{}, fmt.Errorf("encode request: %w", err)
	}
	var wire chatResponse
	finish := ""
	read := func(r io.Reader) error {
		var text strings.Builder
		var calls []toolCall
		scanner := bufio.NewScanner(r)
		scanner.Buffer(make([]byte, 0, 64<<10), 1<<20)
		for scanner.Scan() {
			data, ok := strings.CutPrefix(strings.TrimSpace(scanner.Text()), "data:")
			data = strings.TrimSpace(data)
			if !ok || data == "[DONE]" {
				continue
			}
			var chunk chatChunk
			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				return fmt.Errorf("openai %s: decode chunk: %w", model, err)
			}
			if chunk.Usage != nil {
				wire.Usage = *chunk.Usage
			}
			if len(chunk.Choices) == 0 {
				continue
			}
			c := chunk.Choices[0]
			if c.Delta.Content != "" {
				onText(c.Delta.Content)
				text.WriteString(c.Delta.Content)
			}
			for _, d := range c.Delta.ToolCalls {
				for len(calls) <= d.Index {
					calls = append(calls, toolCall{Type: "function"})
				}
				tc := &calls[d.Index]
				if d.ID != "" {
					tc.ID = d.ID
				}
				tc.Function.Name += d.Function.Name
				tc.Function.Arguments += d.Function.Arguments
			}
			if c.FinishReason != "" {
				finish = c.FinishReason
			}
		}
		if err := scanner.Err(); err != nil {
			return fmt.Errorf("openai %s: read stream: %w: %w", model, llm.ErrTransient, err)
		}
		content := text.String()
		wire.Choices = []choice{{Message: message{Content: &content, ToolCalls: calls}, FinishReason: finish}}
		return nil
	}
	if err := p.do(ctx, http.MethodPost, "/chat/completions", model, body, read); err != nil {
		if ctx.Err() != nil {
			return llm.Response{}, fmt.Errorf("openai %s: %w", model, ctx.Err())
		}
		return llm.Response{}, err
	}
	if finish == "" {
		return llm.Response{}, fmt.Errorf("openai %s: stream ended without a finish reason: %w", model, llm.ErrTransient)
	}
	return fromWire(wire), nil
}

func decodeInto(what string, out any) func(io.Reader) error {
	return func(r io.Reader) error {
		if err := json.NewDecoder(r).Decode(out); err != nil {
			return fmt.Errorf("openai %s: decode response: %w", what, err)
		}
		return nil
	}
}

// Models returns the model IDs the API lists, sorted and without duplicates.
func (p *Provider) Models(ctx context.Context) ([]string, error) {
	var wire modelList
	if err := p.do(ctx, http.MethodGet, "/models", "models", nil, decodeInto("models", &wire)); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(wire.Data))
	for _, m := range wire.Data {
		ids = append(ids, m.ID)
	}
	slices.Sort(ids)
	return slices.Compact(ids), nil
}

func (p *Provider) do(ctx context.Context, method, path, what string, body []byte, read func(io.Reader) error) error {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	httpReq, err := http.NewRequestWithContext(ctx, method, p.baseURL+path, reader)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	if body != nil {
		httpReq.Header.Set("Content-Type", "application/json")
	}
	if p.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	}
	resp, err := p.client.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil {
			return fmt.Errorf("openai %s: %w", what, ctx.Err())
		}
		return fmt.Errorf("openai %s: %w: %w", what, llm.ErrTransient, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
		return statusError(what, resp.StatusCode, resp.Header)
	}
	return read(resp.Body)
}
