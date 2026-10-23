package domain

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestNewProvider(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name, preset, provName, baseURL string
		hasKey                          bool
		wantURL                         string
		wantErr                         error
		wantField                       string
	}{
		{name: "groq with key", preset: "groq", provName: "Groq", hasKey: true, wantURL: "https://api.groq.com/openai/v1"},
		{name: "groq without key", preset: "groq", provName: "Groq", wantErr: ErrKeyRequired},
		{name: "ollama without key", preset: "ollama", provName: "Local", wantURL: "http://127.0.0.1:11434/v1"},
		{name: "own base URL", preset: "ollama", provName: "Box", baseURL: "http://10.0.0.5:11434/v1/", wantURL: "http://10.0.0.5:11434/v1"},
		{name: "custom without URL", preset: "custom", provName: "X", wantField: "base_url"},
		{name: "unknown preset", preset: "nope", provName: "X", wantField: "preset"},
		{name: "ftp", preset: "custom", provName: "X", baseURL: "ftp://h/v1", wantField: "base_url"},
		{name: "user info", preset: "custom", provName: "X", baseURL: "http://u:p@h/v1", wantField: "base_url"},
		{name: "query", preset: "custom", provName: "X", baseURL: "http://h/v1?q=1", wantField: "base_url"},
		{name: "fragment", preset: "custom", provName: "X", baseURL: "http://h/v1#f", wantField: "base_url"},
		{name: "no host", preset: "custom", provName: "X", baseURL: "http:///v1", wantField: "base_url"},
		{name: "blank name", preset: "ollama", provName: "  ", wantField: "name"},
		{name: "long name", preset: "ollama", provName: strings.Repeat("é", 61), wantField: "name"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			p, err := NewProvider(uuid.New(), 7, tt.preset, tt.provName, tt.baseURL, tt.hasKey, now)
			switch {
			case tt.wantErr != nil:
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("err = %v, want %v", err, tt.wantErr)
				}
			case tt.wantField != "":
				fe, ok := errors.AsType[*FieldError](err)
				if !ok || fe.Field != tt.wantField {
					t.Fatalf("err = %v, want a field error on %s", err, tt.wantField)
				}
			default:
				if err != nil {
					t.Fatalf("NewProvider: %v", err)
				}
				if p.BaseURL != tt.wantURL || p.UserID != 7 || p.Preset != tt.preset || !p.CreatedAt.Equal(now) {
					t.Fatalf("provider = %+v, want base URL %s", p, tt.wantURL)
				}
			}
		})
	}
}
