// Package openai calls any API that implements the OpenAI chat completions method.
package openai

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
	if err := p.do(ctx, http.MethodPost, "/chat/completions", model, body, &wire); err != nil {
		return llm.Response{}, err
	}
	return fromWire(wire), nil
}

// Models returns the model IDs the API lists, sorted and without duplicates.
func (p *Provider) Models(ctx context.Context) ([]string, error) {
	var wire modelList
	if err := p.do(ctx, http.MethodGet, "/models", "models", nil, &wire); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(wire.Data))
	for _, m := range wire.Data {
		ids = append(ids, m.ID)
	}
	slices.Sort(ids)
	return slices.Compact(ids), nil
}

func (p *Provider) do(ctx context.Context, method, path, what string, body []byte, out any) error {
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
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("openai %s: decode response: %w", what, err)
	}
	return nil
}
