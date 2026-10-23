package postgres_test

import (
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

var created = time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)

func provider(t *testing.T, userID int64, name string, key []byte) domain.Provider {
	t.Helper()
	p, err := domain.NewProvider(uuid.New(), userID, "ollama", name, "", false, created)
	if err != nil {
		t.Fatal(err)
	}
	p.SealedKey = key
	return p
}

func TestProviders(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	repo := postgres.NewRepository(pool)
	ctx := t.Context()
	a, b := pgtest.CreateUser(t, pool), pgtest.CreateUser(t, pool)
	p := provider(t, a, "Local", []byte{1, 2})
	if err := repo.InsertProvider(ctx, p); err != nil {
		t.Fatal(err)
	}
	if fe, ok := errors.AsType[*domain.FieldError](repo.InsertProvider(ctx, provider(t, a, "Local", nil))); !ok || fe.Field != "name" {
		t.Fatal("repeated name accepted")
	}
	if err := repo.InsertProvider(ctx, provider(t, b, "Local", nil)); err != nil {
		t.Fatalf("same name for another user: %v", err)
	}
	got, err := repo.Provider(ctx, a, p.ID)
	if err == nil && got.CreatedAt.Equal(p.CreatedAt) {
		got.CreatedAt = p.CreatedAt // the driver returns the instant in the session's zone
	}
	if err != nil || !reflect.DeepEqual(got, p) {
		t.Fatalf("Provider = %+v, %v; want %+v", got, err, p)
	}
	if _, err := repo.Provider(ctx, b, p.ID); !errors.Is(err, domain.ErrProviderNotFound) {
		t.Fatalf("other user's Provider err = %v, want ErrProviderNotFound", err)
	}
	p.Name, p.SealedKey = "Renamed", nil
	if err := repo.UpdateProvider(ctx, p); err != nil {
		t.Fatal(err)
	}
	other := p
	other.UserID = b
	if err := repo.UpdateProvider(ctx, other); !errors.Is(err, domain.ErrProviderNotFound) {
		t.Fatalf("other user's UpdateProvider err = %v, want ErrProviderNotFound", err)
	}
	list, err := repo.Providers(ctx, a)
	if err != nil || len(list) != 1 || list[0].Name != "Renamed" || list[0].SealedKey != nil {
		t.Fatalf("Providers = %+v, %v", list, err)
	}
	if err := repo.DeleteProvider(ctx, b, p.ID); !errors.Is(err, domain.ErrProviderNotFound) {
		t.Fatalf("other user's DeleteProvider err = %v, want ErrProviderNotFound", err)
	}
	if err := repo.DeleteProvider(ctx, a, p.ID); err != nil {
		t.Fatal(err)
	}
}

func TestChains(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	repo := postgres.NewRepository(pool)
	ctx := t.Context()
	a, b := pgtest.CreateUser(t, pool), pgtest.CreateUser(t, pool)
	p, q := provider(t, a, "One", nil), provider(t, b, "Other", nil)
	for _, x := range []domain.Provider{p, q} {
		if err := repo.InsertProvider(ctx, x); err != nil {
			t.Fatal(err)
		}
	}
	targets := []domain.ChainTarget{
		{ProviderID: p.ID, Model: "m2", Capabilities: []string{"tools"}},
		{ProviderID: p.ID, Model: "m1", Capabilities: []string{}},
	}
	if err := repo.ReplaceChain(ctx, a, "assistant.chat", targets); err != nil {
		t.Fatal(err)
	}
	chains, err := repo.Chains(ctx, a)
	if err != nil || !reflect.DeepEqual(chains, map[string][]domain.ChainTarget{"assistant.chat": targets}) {
		t.Fatalf("Chains = %+v, %v", chains, err)
	}
	foreign := []domain.ChainTarget{{ProviderID: q.ID, Model: "m", Capabilities: []string{}}}
	if err := repo.ReplaceChain(ctx, a, "assistant.chat", foreign); !errors.Is(err, domain.ErrProviderNotFound) {
		t.Fatalf("chain on another user's provider err = %v, want ErrProviderNotFound", err)
	}
	if chains, _ := repo.Chains(ctx, a); len(chains["assistant.chat"]) != 2 {
		t.Fatalf("failed replace changed the chain: %+v", chains)
	}
	if err := repo.DeleteProvider(ctx, a, p.ID); err != nil {
		t.Fatal(err)
	}
	if chains, _ := repo.Chains(ctx, a); len(chains) != 0 {
		t.Fatalf("chain targets kept after the provider was deleted: %+v", chains)
	}
}

func TestResealKeys(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	repo := postgres.NewRepository(pool)
	ctx := t.Context()
	a := pgtest.CreateUser(t, pool)
	keyed, keyless := provider(t, a, "Keyed", []byte("old")), provider(t, a, "Keyless", nil)
	for _, x := range []domain.Provider{keyed, keyless} {
		if err := repo.InsertProvider(ctx, x); err != nil {
			t.Fatal(err)
		}
	}
	var seen []uuid.UUID
	n, err := repo.ResealKeys(ctx, func(userID int64, id uuid.UUID, sealed []byte) ([]byte, error) {
		seen = append(seen, id)
		if userID != a || string(sealed) != "old" {
			t.Errorf("reseal got user %d, sealed %q", userID, sealed)
		}
		return []byte("new"), nil
	})
	if err != nil || n != 1 || !reflect.DeepEqual(seen, []uuid.UUID{keyed.ID}) {
		t.Fatalf("ResealKeys = %d, %v; seen %v", n, err, seen)
	}
	if got, _ := repo.Provider(ctx, a, keyed.ID); string(got.SealedKey) != "new" {
		t.Fatalf("sealed key = %q, want new", got.SealedKey)
	}
}
