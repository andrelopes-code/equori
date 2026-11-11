package assistant

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

// ChatUse is the conversational agent's use, consumed by the agent project.
var ChatUse = llm.Use{
	ID:                 "assistant.chat",
	Needs:              []llm.Capability{llm.CapTools},
	SendsFinancialData: true,
	Default: []llm.DefaultTarget{
		{Preset: "gemini", Model: "gemini-3.5-flash"},
		{Preset: "gemini", Model: "gemini-3.5-flash-lite"},
		{Preset: "gemini", Model: "gemini-3.1-flash-lite"},
		{Preset: "groq", Model: "openai/gpt-oss-120b"},
		{Preset: "mistral", Model: "mistral-small-latest"},
		{Preset: "ollama", Model: "qwen3:32b"},
	},
}

type Config struct {
	SecretKey, PreviousSecretKey string
	// Instance are the providers configured through the environment, shared by every book.
	Instance []llm.Provider
	Uses     []llm.Use
	// Navigation is web/src/navigation/navigation-map.json (spec 9); empty means no screens.
	Navigation []byte
	// Locale returns the language of the member and the region of the book for the system prompt.
	Locale func(context.Context, int64) (locale.Locale, error)
	Clock  clock.Clock
	// NewProvider builds a book's provider; nil builds the real adapters.
	NewProvider func(api, baseURL, key string) llm.Provider
	// Wait blocks a chat turn until a transient cooldown ends (design 2026-10-26 E6); nil uses a timer on Clock.
	Wait func(ctx context.Context, until time.Time) error
}
