package server

import (
	"context"
	"encoding/json/v2"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/ingestion"
	"github.com/andrelopes-code/equori/internal/platform/secret"
	"github.com/andrelopes-code/equori/internal/reporting"
)

// integrationCredentials is what the export takes from ingestion (export design C2, C6).
type integrationCredentials interface {
	ExportCredentials(ctx context.Context, booksID int64) (map[uuid.UUID]map[string]string, error)
	SealCredentials(booksID int64, plain map[uuid.UUID]map[string]string) (map[uuid.UUID][]byte, error)
}

// providerKeys is what the export takes from assistant (export design T3, T5).
type providerKeys interface {
	ExportProviderKeys(ctx context.Context, booksID int64) (map[uuid.UUID]string, error)
	SealProviderKeys(booksID int64, keys map[uuid.UUID]string) (map[uuid.UUID][]byte, error)
}

// credentialSource lends the integration credentials and the provider keys to the export of
// reporting. One passphrase seals both in one bundle (export design C3, T3, T4).
type credentialSource struct {
	integrations integrationCredentials
	providers    providerKeys
}

// bundlePlaintext is the plaintext of the archive entry credentials.enc.
type bundlePlaintext struct {
	Credentials  map[uuid.UUID]map[string]string `json:"credentials"`
	ProviderKeys map[uuid.UUID]string            `json:"provider_keys,omitempty"`
}

func (s credentialSource) Bundle(ctx context.Context, booksID int64, passphrase string) ([]byte, error) {
	credentials, err := s.integrations.ExportCredentials(ctx, booksID)
	if err != nil {
		return nil, credentialError(err)
	}

	keys, err := s.providers.ExportProviderKeys(ctx, booksID)
	if err != nil {
		return nil, credentialError(err)
	}

	if len(credentials) == 0 && len(keys) == 0 {
		return nil, nil
	}

	plain, err := json.Marshal(bundlePlaintext{Credentials: credentials, ProviderKeys: keys})
	if err != nil {
		return nil, err
	}

	return secret.SealWithPassphrase(plain, passphrase)
}

func (s credentialSource) Reseal(booksID int64, passphrase string, bundle []byte) (reporting.SealedCredentials, error) {
	plain, err := secret.OpenWithPassphrase(bundle, passphrase)
	if err != nil {
		return reporting.SealedCredentials{}, reporting.ErrPassphraseInvalid
	}

	var b bundlePlaintext
	if err := json.Unmarshal(plain, &b); err != nil {
		return reporting.SealedCredentials{}, reporting.ErrPassphraseInvalid
	}

	var sealed reporting.SealedCredentials

	if sealed.Integrations, err = s.integrations.SealCredentials(booksID, b.Credentials); err != nil {
		return reporting.SealedCredentials{}, credentialError(err)
	}

	if sealed.Providers, err = s.providers.SealProviderKeys(booksID, b.ProviderKeys); err != nil {
		return reporting.SealedCredentials{}, credentialError(err)
	}

	return sealed, nil
}

// credentialError names an error of ingestion or assistant in the terms of reporting.
func credentialError(err error) error {
	if errors.Is(err, ingestion.ErrIntegrationUnavailable) || errors.Is(err, assistant.ErrSecretKeyMissing) {
		return reporting.ErrCredentialsUnavailable
	}

	return err
}
