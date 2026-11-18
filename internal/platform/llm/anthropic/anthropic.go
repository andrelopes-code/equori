// Package anthropic calls the Anthropic Messages API.
package anthropic

import (
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

const name = "anthropic"

// apiVersion is the API version Anthropic requires on every request.
const apiVersion = "2023-06-01"

type Provider struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

// New returns the provider for the API at baseURL, the only address it contacts (N17).
func New(baseURL, apiKey string, client *http.Client) *Provider {
	return &Provider{baseURL: strings.TrimSuffix(baseURL, "/"), apiKey: apiKey, client: client}
}

func (p *Provider) Name() string { return name }

func (p *Provider) Generate(
	ctx context.Context,
	model string,
	req llm.Request,
) (llm.Response, error) {
	if err := checkFiles(req); err != nil {
		return llm.Response{}, err
	}

	body, err := json.Marshal(toWire(model, req))
	if err != nil {
		return llm.Response{}, fmt.Errorf("encode request: %w", err)
	}

	var wire messagesResponse
	if err := p.do(
		ctx,
		http.MethodPost,
		"/messages",
		model,
		body,
		decodeInto(model, &wire),
	); err != nil {
		return llm.Response{}, err
	}

	return fromWire(wire), nil
}

// Stream asks for a streamed message and accumulates its content blocks into the response
// Generate would return. A stream that ends before it names its stop reason is a transient
// failure.
func (p *Provider) Stream(
	ctx context.Context,
	model string,
	req llm.Request,
	onText func(string),
) (llm.Response, error) {
	if err := checkFiles(req); err != nil {
		return llm.Response{}, err
	}

	w := toWire(model, req)
	w.Stream = true

	body, err := json.Marshal(w)
	if err != nil {
		return llm.Response{}, fmt.Errorf("encode request: %w", err)
	}

	var st streamState

	read := func(r io.Reader) error { return st.read(r, model, onText) }
	if err := p.do(ctx, http.MethodPost, "/messages", model, body, read); err != nil {
		if ctx.Err() != nil {
			return llm.Response{}, fmt.Errorf("anthropic %s: %w", model, ctx.Err())
		}

		return llm.Response{}, err
	}

	if st.stop == "" {
		return llm.Response{}, fmt.Errorf(
			"anthropic %s: stream ended without a stop reason: %w", model, llm.ErrTransient)
	}

	wire, err := st.response()
	if err != nil {
		return llm.Response{}, fmt.Errorf("anthropic %s: %w", model, err)
	}

	return fromWire(wire), nil
}

// Models returns the model IDs the API lists, sorted and without duplicates.
func (p *Provider) Models(ctx context.Context) ([]string, error) {
	var wire modelList
	if err := p.do(
		ctx,
		http.MethodGet,
		"/models?limit=1000",
		"models",
		nil,
		decodeInto("models", &wire),
	); err != nil {
		return nil, err
	}

	ids := make([]string, 0, len(wire.Data))
	for _, m := range wire.Data {
		ids = append(ids, m.ID)
	}

	slices.Sort(ids)

	return slices.Compact(ids), nil
}

func (p *Provider) do(
	ctx context.Context,
	method, path, what string,
	body []byte,
	read func(io.Reader) error,
) error {
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

	httpReq.Header.Set("X-Api-Key", p.apiKey)
	httpReq.Header.Set("Anthropic-Version", apiVersion)

	resp, err := p.client.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil {
			return fmt.Errorf("anthropic %s: %w", what, ctx.Err())
		}

		return fmt.Errorf("anthropic %s: %w: %w", what, llm.ErrTransient, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
		return statusError(what, resp.StatusCode, resp.Header)
	}

	return read(resp.Body)
}

func decodeInto(what string, out any) func(io.Reader) error {
	return func(r io.Reader) error {
		if err := json.NewDecoder(r).Decode(out); err != nil {
			return fmt.Errorf("anthropic %s: decode response: %w", what, err)
		}

		return nil
	}
}
