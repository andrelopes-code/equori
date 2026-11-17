package server

import (
	"context"
	"io/fs"
	"time"

	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/instance"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type Config struct {
	// Version is the version of the running app; "dev" when empty (ADR 021).
	Version       string
	SecureCookies bool
	// SetupDone runs after the first user is created from the browser (W-U5).
	SetupDone func()
	// Clock defaults to the current time in UTC when nil.
	Clock *clock.Clock
	// Web holds the built single-page application; nil answers 404 outside /api/.
	Web fs.FS
	// WebDevPort, when set, redirects every path outside /api/ to the Vite server on that port
	// instead of serving Web (ADR 028, development).
	WebDevPort int
	// APIDocs registers GET /docs and GET /openapi.yaml.
	APIDocs bool
	// IdentityNow replaces the clock of identity; tests set it, production passes none.
	IdentityNow func() time.Time
	// PasswordCost lowers the argon2id cost of new hashes; tests set it, production passes none.
	PasswordCost identity.PasswordCost
	// SecretKey and PreviousSecretKey seal integration credentials (ADR 008): 32 raw bytes,
	// empty when unset.
	SecretKey, PreviousSecretKey string
	// AggregatorURLs overrides the base URL of an aggregator, by identifier.
	AggregatorURLs map[string]string
	// LLMProviders are language model providers for the whole instance (ADR 009); tests inject
	// them, production passes none (BK24); each book adds its own (ADR 019).
	LLMProviders []llm.Provider
	// LLMFactory builds a book's provider; nil builds the real adapters. Tests replace it.
	LLMFactory func(api, baseURL, key string) llm.Provider
	// LLMWait blocks a chat turn until a transient cooldown ends; nil uses a timer on Clock.
	LLMWait func(ctx context.Context, until time.Time) error
	// PriceFeeds and IndexFeeds name the feeds enabled while no feed setting is stored; tests set
	// them, production passes none (ADR 025 F2, BK25); FeedURLs overrides the base URLs of every
	// feed by identifier.
	PriceFeeds []string
	IndexFeeds []string
	FeedURLs   map[string]string
	// CatalogBound and ProbeBound bound one source in a catalog search and in a probe; zero keeps
	// the defaults of marketdata.WithFeeds (A222 MQ27, MQ29).
	CatalogBound, ProbeBound time.Duration
	// CurrentBound bounds the wait of a read for current quotes; zero keeps the default of
	// marketdata.WithFeeds (A248 CQ14).
	CurrentBound time.Duration
	// ExtraTools join the registry and the chat set; production passes none.
	ExtraTools []tool.Group
	// Instance configures backups and the encrypted copy; New sets Version, the keys, Clock, Admins,
	// Outbox and Connections.
	Instance instance.Config
}
