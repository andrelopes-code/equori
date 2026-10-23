package assistant_test

import (
	"context"
	"fmt"
	"log/slog"
	"reflect"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
	"github.com/andrelopes-code/equori/internal/platform/secret"
)

var (
	keyA = string(make([]byte, 32))
	keyB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
)

// made records the providers the module built: API, base URL and key.
type made struct{ calls []string }

func (m *made) factory(api, baseURL, key string) llm.Provider {
	m.calls = append(m.calls, api+" "+baseURL+" "+key)
	return llmtest.New(api)
}

type world struct {
	pool *pgxpool.Pool
	user int64
	made *made
}

func newWorld(t *testing.T) *world {
	t.Helper()
	pool := pgtest.New(t)
	return &world{pool: pool, user: pgtest.CreateUser(t, pool), made: &made{}}
}

func (w *world) module(t *testing.T, current, previous string) *assistant.Module {
	t.Helper()
	clk := clock.New(time.UTC, time.Now)
	m, err := assistant.New(w.pool, assistant.Config{
		SecretKey: current, PreviousSecretKey: previous, Clock: clk,
		Instance: []llm.Provider{llmtest.New("aistudio")}, Uses: []llm.Use{assistant.ChatUse},
		NewProvider: w.made.factory,
	}, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatal(err)
	}
	return m
}

// provider inserts a provider sealed under sealKey ("" for none) and returns its ID.
func (w *world) provider(t *testing.T, preset, name, baseURL, key, sealKey string, created time.Time) uuid.UUID {
	t.Helper()
	id := uuid.New()
	var sealed []byte
	if sealKey != "" {
		box, err := secret.New([]byte(sealKey), nil)
		if err != nil {
			t.Fatal(err)
		}
		if sealed, err = box.Seal([]byte(key), fmt.Appendf(nil, "assistant_provider|%d|%s", w.user, id)); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := w.pool.Exec(t.Context(), `INSERT INTO assistant_provider VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		id, w.user, preset, name, baseURL, sealed, created); err != nil {
		t.Fatal(err)
	}
	return id
}

func (w *world) chain(t *testing.T, use string, provider uuid.UUID, models ...string) {
	t.Helper()
	for i, m := range models {
		if _, err := w.pool.Exec(t.Context(), `INSERT INTO assistant_chain_target VALUES ($1, $2, $3, $4, $5, '{tools}')`,
			w.user, use, i, provider, m); err != nil {
			t.Fatal(err)
		}
	}
}

func targets(t *testing.T, m *assistant.Module, ctx context.Context, use llm.Use) []string {
	t.Helper()
	bindings, err := m.Resolver().Resolve(ctx, use)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	var out []string
	for _, b := range bindings {
		out = append(out, b.Target.String())
	}
	return out
}

var day = time.Date(2026, 10, 23, 0, 0, 0, 0, time.UTC)

func TestResolveDefault(t *testing.T) {
	t.Parallel()
	w := newWorld(t)
	groq := w.provider(t, "groq", "Groq", "https://api.groq.com/openai/v1", "gk", keyA, day)
	gemini := w.provider(t, "gemini", "Gemini", "https://generativelanguage.googleapis.com", "ek", keyA, day.Add(time.Hour))
	m := w.module(t, keyA, "")
	got := targets(t, m, auth.WithUserID(t.Context(), w.user), assistant.ChatUse)
	want := []string{gemini.String() + "/gemini-3.5-flash", "aistudio/gemini-3.5-flash", groq.String() + "/openai/gpt-oss-120b"}
	if !slices.Equal(got, want) {
		t.Fatalf("targets = %v, want %v", got, want)
	}
	wantMade := []string{"gemini https://generativelanguage.googleapis.com ek", "openai https://api.groq.com/openai/v1 gk"}
	if !reflect.DeepEqual(w.made.calls, wantMade) {
		t.Fatalf("built providers = %v, want %v", w.made.calls, wantMade)
	}
}

func TestResolveUserChain(t *testing.T) {
	t.Parallel()
	w := newWorld(t)
	local := w.provider(t, "ollama", "Local", "http://127.0.0.1:11434/v1", "", "", day)
	w.chain(t, "assistant.chat", local, "b", "a")
	if _, err := w.pool.Exec(t.Context(), `UPDATE assistant_chain_target SET capabilities = '{}' WHERE model = 'a'`); err != nil {
		t.Fatal(err)
	}
	m := w.module(t, "", "")
	got := targets(t, m, auth.WithUserID(t.Context(), w.user), assistant.ChatUse)
	if want := []string{local.String() + "/b"}; !slices.Equal(got, want) {
		t.Fatalf("targets = %v, want %v (a lacks tools)", got, want)
	}
}

func TestResolveWithoutUser(t *testing.T) {
	t.Parallel()
	w := newWorld(t)
	w.provider(t, "gemini", "Gemini", "https://generativelanguage.googleapis.com", "ek", keyA, day)
	m := w.module(t, keyA, "")
	if got, want := targets(t, m, t.Context(), assistant.ChatUse), []string{"aistudio/gemini-3.5-flash"}; !slices.Equal(got, want) {
		t.Fatalf("targets = %v, want %v", got, want)
	}
}

func TestResolveUnreadableKey(t *testing.T) {
	t.Parallel()
	w := newWorld(t)
	w.provider(t, "groq", "Groq", "https://api.groq.com/openai/v1", "gk", keyB, day)
	m := w.module(t, keyA, "")
	if got, want := targets(t, m, auth.WithUserID(t.Context(), w.user), assistant.ChatUse), []string{"aistudio/gemini-3.5-flash"}; !slices.Equal(got, want) {
		t.Fatalf("targets = %v, want %v", got, want)
	}
}

func TestRotateSecrets(t *testing.T) {
	t.Parallel()
	w := newWorld(t)
	groq := w.provider(t, "groq", "Groq", "https://api.groq.com/openai/v1", "gk", keyA, day)
	m := w.module(t, keyB, keyA)
	n, err := m.RotateSecrets(t.Context())
	if err != nil || n != 1 {
		t.Fatalf("RotateSecrets = %d, %v; want 1", n, err)
	}
	after := w.module(t, keyB, "")
	got := targets(t, after, auth.WithUserID(t.Context(), w.user), assistant.ChatUse)
	if want := []string{"aistudio/gemini-3.5-flash", groq.String() + "/openai/gpt-oss-120b"}; !slices.Equal(got, want) {
		t.Fatalf("targets after rotation = %v, want %v", got, want)
	}
}
