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

func (p *Provider) Generate(
	ctx context.Context,
	model string,
	req llm.Request,
) (llm.Response, error) {
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
func (p *Provider) Stream(
	ctx context.Context,
	model string,
	req llm.Request,
	onText func(string),
) (llm.Response, error) {
	resp, err := p.post(ctx, model, ":streamGenerateContent?alt=sse", req)
	if err != nil {
		return llm.Response{}, err
	}

	defer resp.Body.Close()

	st, err := readChunks(ctx, model, resp.Body, onText)
	if err != nil {
		return llm.Response{}, err
	}

	return st.response(model)
}

// streamState is the merge of the chunks read so far.
type streamState struct {
	merged generateResponse
	parts  []part
	finish string
}

func readChunks(
	ctx context.Context,
	model string,
	body io.Reader,
	onText func(string),
) (streamState, error) {
	var st streamState

	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64<<10), 1<<20)

	for scanner.Scan() {
		data, ok := strings.CutPrefix(strings.TrimSpace(scanner.Text()), "data:")
		if !ok {
			continue
		}

		var chunk generateResponse
		if err := json.Unmarshal([]byte(strings.TrimSpace(data)), &chunk); err != nil {
			return streamState{}, fmt.Errorf("aistudio %s: decode chunk: %w", model, err)
		}

		st.mergeChunk(chunk, onText)
	}

	if err := scanner.Err(); err != nil {
		if ctx.Err() != nil {
			return streamState{}, fmt.Errorf("aistudio %s: %w", model, ctx.Err())
		}

		return streamState{}, fmt.Errorf(
			"aistudio %s: read stream: %w: %w", model, llm.ErrTransient, err)
	}

	return st, nil
}

// mergeChunk folds one chunk into the state and hands its new text to onText.
func (st *streamState) mergeChunk(chunk generateResponse, onText func(string)) {
	um := chunk.UsageMetadata
	if um.PromptTokenCount > 0 || um.CandidatesTokenCount > 0 {
		st.merged.UsageMetadata = um
	}

	if chunk.PromptFeedback != nil {
		st.merged.PromptFeedback = chunk.PromptFeedback
	}

	if len(chunk.Candidates) == 0 {
		return
	}

	c := chunk.Candidates[0]
	if c.FinishReason != "" {
		st.finish = c.FinishReason
	}

	if c.Content == nil {
		return
	}

	for _, np := range c.Content.Parts {
		if np.Thought {
			continue
		}

		if np.Text != nil && *np.Text != "" {
			onText(*np.Text)
		}

		st.parts = mergePart(st.parts, np)
	}
}

// response builds the Response of the merged chunks.
func (st streamState) response(model string) (llm.Response, error) {
	fb := st.merged.PromptFeedback
	if fb != nil && fb.BlockReason != "" && len(st.parts) == 0 {
		return fromWire(st.merged), nil
	}

	if st.finish == "" {
		return llm.Response{}, fmt.Errorf(
			"aistudio %s: stream ended without a finish reason: %w", model, llm.ErrTransient)
	}

	st.merged.Candidates = []candidate{
		{Content: &content{Role: "model", Parts: st.parts}, FinishReason: st.finish},
	}

	return fromWire(st.merged), nil
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
func (p *Provider) post(
	ctx context.Context,
	model, method string,
	req llm.Request,
) (*http.Response, error) {
	body, err := json.Marshal(toWire(req))
	if err != nil {
		return nil, fmt.Errorf("encode request: %w", err)
	}

	endpoint := p.baseURL + "/v1beta/models/" + url.PathEscape(model) + method

	httpReq, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		endpoint,
		bytes.NewReader(body),
	)
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
	httpReq, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		p.baseURL+"/v1beta/models?pageSize=1000",
		nil,
	)
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
