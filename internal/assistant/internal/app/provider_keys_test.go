package app_test

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/secret"
)

const providerKeysBook = int64(7)

// providerList answers Providers only; every other port call fails the test by a nil dereference.
type providerList struct {
	app.Repository
	list []domain.Provider
}

func (p providerList) Providers(context.Context, int64) ([]domain.Provider, error) {
	return p.list, nil
}

func newBox(t *testing.T, key byte) *secret.Box {
	t.Helper()

	box, err := secret.New([]byte(fmt.Sprintf("%032d", key)), nil)
	if err != nil {
		t.Fatal(err)
	}

	return box
}

func associated(booksID int64, id uuid.UUID) []byte {
	return fmt.Appendf(nil, "assistant_provider|%d|%s", booksID, id)
}

// Export design T3, T5: the keys that open leave in the clear; the rest is left out.
func TestExportProviderKeys(t *testing.T) {
	t.Parallel()

	box, other := newBox(t, 1), newBox(t, 2)
	keyed, unreadable, keyless := uuid.New(), uuid.New(), uuid.New()

	sealed, err := box.Seal([]byte("gsk-one"), associated(providerKeysBook, keyed))
	if err != nil {
		t.Fatal(err)
	}

	foreign, err := other.Seal([]byte("gsk-two"), associated(providerKeysBook, unreadable))
	if err != nil {
		t.Fatal(err)
	}

	svc := app.NewService(providerList{list: []domain.Provider{
		{ID: keyed, BooksID: providerKeysBook, SealedKey: sealed},
		{ID: unreadable, BooksID: providerKeysBook, SealedKey: foreign},
		{ID: keyless, BooksID: providerKeysBook},
	}}, box, nil, nil, nil, nil, nil, nil)

	got, err := svc.ExportProviderKeys(t.Context(), providerKeysBook)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 1 || got[keyed] != "gsk-one" {
		t.Fatalf("keys = %v, want only %s", got, keyed)
	}
}

// Export design T5: a key sealed for the importing book opens with the associated data of ADR 019 P1.
func TestSealProviderKeys(t *testing.T) {
	t.Parallel()

	box, id := newBox(t, 1), uuid.New()
	svc := app.NewService(providerList{}, box, nil, nil, nil, nil, nil, nil)

	sealed, err := svc.SealProviderKeys(providerKeysBook, map[uuid.UUID]string{id: "gsk-one"})
	if err != nil {
		t.Fatal(err)
	}

	plain, err := box.Open(sealed[id], associated(providerKeysBook, id))
	if err != nil || string(plain) != "gsk-one" {
		t.Fatalf("open = %q, %v", plain, err)
	}

	if _, err := box.Open(sealed[id], associated(providerKeysBook+1, id)); err == nil {
		t.Error("the key opens for another book")
	}
}

// Export design T1, K2 of ADR 008: without the instance key both directions are refused.
func TestProviderKeysNeedTheInstanceKey(t *testing.T) {
	t.Parallel()

	svc := app.NewService(providerList{}, nil, nil, nil, nil, nil, nil, nil)

	if _, err := svc.ExportProviderKeys(t.Context(), providerKeysBook); !errors.Is(err, app.ErrSecretKeyMissing) {
		t.Errorf("export = %v, want ErrSecretKeyMissing", err)
	}

	if _, err := svc.SealProviderKeys(providerKeysBook, map[uuid.UUID]string{uuid.New(): "k"}); !errors.Is(err, app.ErrSecretKeyMissing) {
		t.Errorf("seal = %v, want ErrSecretKeyMissing", err)
	}
}
