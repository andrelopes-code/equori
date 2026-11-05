package server

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion"
	"github.com/andrelopes-code/equori/internal/platform/secret"
	"github.com/andrelopes-code/equori/internal/reporting"
)

const bundlePassphrase = "correct horse battery"

type fakeIntegrations struct {
	plain map[uuid.UUID]map[string]string
	err   error
}

func (f fakeIntegrations) ExportCredentials(context.Context, int64) (map[uuid.UUID]map[string]string, error) {
	return f.plain, f.err
}

func (f fakeIntegrations) SealCredentials(_ int64, plain map[uuid.UUID]map[string]string) (map[uuid.UUID][]byte, error) {
	out := map[uuid.UUID][]byte{}
	for id := range plain {
		out[id] = []byte("sealed-integration")
	}

	return out, nil
}

type fakeProviderKeys struct{ keys map[uuid.UUID]string }

func (f fakeProviderKeys) ExportProviderKeys(context.Context, int64) (map[uuid.UUID]string, error) {
	return f.keys, nil
}

func (f fakeProviderKeys) SealProviderKeys(_ int64, keys map[uuid.UUID]string) (map[uuid.UUID][]byte, error) {
	out := map[uuid.UUID][]byte{}
	for id := range keys {
		out[id] = []byte("sealed-provider")
	}

	return out, nil
}

// Export design T3, T4: one passphrase seals both members.
func TestBundleCarriesBothMembers(t *testing.T) {
	t.Parallel()

	integration, provider := uuid.New(), uuid.New()
	src := credentialSource{
		fakeIntegrations{plain: map[uuid.UUID]map[string]string{integration: {"client_id": "c", "client_secret": "s"}}},
		fakeProviderKeys{keys: map[uuid.UUID]string{provider: "gsk-one"}},
	}

	bundle, err := src.Bundle(t.Context(), 7, bundlePassphrase)
	if err != nil || bundle == nil {
		t.Fatalf("bundle = %v, %v", bundle, err)
	}

	sealed, err := src.Reseal(7, bundlePassphrase, bundle)
	if err != nil {
		t.Fatal(err)
	}

	if string(sealed.Integrations[integration]) != "sealed-integration" || len(sealed.Integrations) != 1 ||
		string(sealed.Providers[provider]) != "sealed-provider" || len(sealed.Providers) != 1 {
		t.Fatalf("sealed = %+v", sealed)
	}

	if _, err := src.Reseal(7, "another passphrase", bundle); !errors.Is(err, reporting.ErrPassphraseInvalid) {
		t.Errorf("wrong passphrase = %v, want ErrPassphraseInvalid", err)
	}
}

// Export design T3: a bundle written before the amendment has no provider_keys member.
func TestBundleWithoutProviderKeysStillOpens(t *testing.T) {
	t.Parallel()

	id := uuid.New()

	old, err := secret.SealWithPassphrase([]byte(`{"credentials":{"`+id.String()+`":{"client_id":"c"}}}`), bundlePassphrase)
	if err != nil {
		t.Fatal(err)
	}

	src := credentialSource{fakeIntegrations{}, fakeProviderKeys{}}

	sealed, err := src.Reseal(7, bundlePassphrase, old)
	if err != nil {
		t.Fatal(err)
	}

	if len(sealed.Integrations) != 1 || len(sealed.Providers) != 0 {
		t.Fatalf("sealed = %+v", sealed)
	}
}

// Export design T3: a book with nothing to carry has no bundle; a missing instance key is
// named in the terms of reporting.
func TestBundleIsNilWhenEmpty(t *testing.T) {
	t.Parallel()

	bundle, err := credentialSource{fakeIntegrations{}, fakeProviderKeys{}}.Bundle(t.Context(), 7, bundlePassphrase)
	if bundle != nil || err != nil {
		t.Fatalf("bundle = %v, %v, want nil", bundle, err)
	}

	_, err = credentialSource{fakeIntegrations{err: ingestion.ErrIntegrationUnavailable}, fakeProviderKeys{}}.Bundle(t.Context(), 7, bundlePassphrase)
	if !errors.Is(err, reporting.ErrCredentialsUnavailable) {
		t.Fatalf("err = %v, want ErrCredentialsUnavailable", err)
	}
}
